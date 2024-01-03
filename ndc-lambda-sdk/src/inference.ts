import ts, { FunctionDeclaration } from "typescript";
import * as tsutils from "ts-api-utils";
import path from "node:path"
import * as schema from "./schema";
import { throwError, unreachable } from "./util";
import { Err, Ok, Result } from "./result";

type SchemaDerivationResults = {
  compilerDiagnostics: ts.Diagnostic[]
  functionIssues: FunctionIssues
  functionsSchema: schema.FunctionsSchema
}

type FunctionIssues = {
  [functionName: string]: string[]
}

export function deriveSchema(functionsFilePath: string): SchemaDerivationResults {
  const programResult = createTsProgram(functionsFilePath)
  if (programResult instanceof Ok) {
    const [program, compilerDiagnostics] = programResult.data;
    const sourceFile = program.getSourceFile(functionsFilePath)
    if (!sourceFile) throw new Error(`'${functionsFilePath}' not returned as a TypeScript compiler source file`);

    const [functionsSchema, functionIssues] = deriveSchemaFromFunctions(sourceFile, program.getTypeChecker());
    return {
      compilerDiagnostics,
      functionsSchema,
      functionIssues
    }
  } else {
    return {
      compilerDiagnostics: programResult.error,
      functionIssues: {},
      functionsSchema: {
        functions: {},
        objectTypes: {},
        scalarTypes: {}
      }
    }
  }
}

function createTsProgram(functionsFilePath: string): Result<[ts.Program, ts.Diagnostic[]], ts.Diagnostic[]> {
  const fileDirectory = path.dirname(functionsFilePath);
  return loadTsConfig(fileDirectory).bind(parsedCommandLine => {
    const compilerHost = ts.createCompilerHost(parsedCommandLine.options);
    const program = ts.createProgram([functionsFilePath], parsedCommandLine.options, compilerHost);
    const compilerDiagnostics = ts.getPreEmitDiagnostics(program);
    return compilerDiagnostics.find(d => d.category === ts.DiagnosticCategory.Error) === undefined
      ? new Ok([program, [...compilerDiagnostics]])
      : new Err([...compilerDiagnostics]);
  })
}

function loadTsConfig(functionsDir: string): Result<ts.ParsedCommandLine, ts.Diagnostic[]> {
  const configPath = ts.findConfigFile(functionsDir, ts.sys.fileExists) ?? path.resolve(require.resolve("@tsconfig/node18/tsconfig.json"));
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
  if (configFile.error) {
    return new Err([configFile.error])
  }
  const parsedCommandLine = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));
  if (parsedCommandLine.errors.find(d => d.category === ts.DiagnosticCategory.Error) !== undefined) {
    return new Err([...parsedCommandLine.errors]);
  }
  return new Ok(parsedCommandLine);
}

export function printCompilerDiagnostics(diagnostics: ts.Diagnostic[]) {
  const host: ts.FormatDiagnosticsHost = {
    getNewLine: () => ts.sys.newLine,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getCanonicalFileName: x => x
  }
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, host));
}

export function printFunctionIssues(functionIssues: FunctionIssues) {
  for (const [functionName, issues] of Object.entries(functionIssues)) {
    for (const issue of issues) {
      console.error(`${functionName}: ${issue}`)
    }
  }
}

type TypeDerivationContext = {
  objectTypeDefinitions: schema.ObjectTypeDefinitions
  scalarTypeDefinitions: schema.ScalarTypeDefinitions
  typeChecker: ts.TypeChecker
  functionsFilePath: string,
}

function deriveSchemaFromFunctions(sourceFile: ts.SourceFile, typeChecker: ts.TypeChecker): [schema.FunctionsSchema, FunctionIssues] {
  const typeDerivationContext: TypeDerivationContext = {
    objectTypeDefinitions: {},
    scalarTypeDefinitions: {},
    typeChecker,
    functionsFilePath: sourceFile.fileName
  }
  const schemaFunctions: schema.FunctionDefinitions = {};
  const functionIssues: FunctionIssues = {};

  const functionDeclarations: FunctionDeclaration[] = [];
  sourceFile.forEachChild(child => {
    if (ts.isFunctionDeclaration(child) && isExportedFunction(child)) {
      functionDeclarations.push(child);
    }
  });

  for (const functionDeclaration of functionDeclarations) {
    const result = deriveFunctionSchema(functionDeclaration, typeDerivationContext);
    if (result.issues.length > 0) {
      functionIssues[result.name] = result.issues;
    }
    if (result.definition) {
      schemaFunctions[result.name] = result.definition;
    }
  }

  const functionsSchema = {
    functions: schemaFunctions,
    objectTypes: typeDerivationContext.objectTypeDefinitions,
    scalarTypes: typeDerivationContext.scalarTypeDefinitions,
  };

  return [functionsSchema, functionIssues];
}

function isExportedFunction(node: ts.FunctionDeclaration): boolean {
  return (node.modifiers ?? []).find(mod => mod.kind === ts.SyntaxKind.ExportKeyword) !== undefined;
}

// This result captures the possibility that we can fail to generate a definition for a function
// (and captures the errors associated with that), but also captures that we can also
// generate a definition but there still are issues.
type DeriveFunctionSchemaResult = {
  name: string,
  definition: schema.FunctionDefinition | null,
  issues: string[]
}

function deriveFunctionSchema(functionDeclaration: ts.FunctionDeclaration, context: TypeDerivationContext): DeriveFunctionSchemaResult {
  let functionIsBroken = false;
  const issues: string[] = [];

  const functionIdentifier = functionDeclaration.name ?? throwError("Function didn't have an identifier");
  const functionName = functionIdentifier.text
  const functionSymbol = context.typeChecker.getSymbolAtLocation(functionIdentifier) ?? throwError(`Function '${functionName}' didn't have a symbol`);
  const functionType = context.typeChecker.getTypeOfSymbolAtLocation(functionSymbol, functionDeclaration);

  const functionDescription = ts.displayPartsToString(functionSymbol.getDocumentationComment(context.typeChecker)).trim();
  const markedPureInJsDoc = functionSymbol.getJsDocTags().find(e => e.name === "pure") !== undefined;

  const functionCallSig = functionType.getCallSignatures()[0] ?? throwError(`Function '${functionName}' didn't have a call signature`)
  const functionSchemaArguments: schema.ArgumentDefinition[] = functionCallSig.getParameters().flatMap(paramSymbol => {
    const paramName = paramSymbol.getName();
    const paramDesc = ts.displayPartsToString(paramSymbol.getDocumentationComment(context.typeChecker)).trim();
    const paramType = context.typeChecker.getTypeOfSymbolAtLocation(paramSymbol, paramSymbol.valueDeclaration ?? throwError(`Function '${functionName}' parameter '${paramName}' didn't have a value declaration`));
    const paramTypePath: TypePathSegment[] = [{segmentType: "FunctionParameter", functionName, parameterName: paramName}];

    const paramTypeResult = deriveSchemaTypeForTsType(paramType, paramTypePath, context);

    if (paramTypeResult instanceof Err) {
      // Record the error, discard the parameter, but mark the function
      // as broken so we discard the whole thing at the end
      issues.push(...paramTypeResult.error)
      functionIsBroken = true;
      return [];
    } else {
      issues.push(...paramTypeResult.data.warnings)
      return [{
        argumentName: paramName,
        description: paramDesc ? paramDesc : null,
        type: paramTypeResult.data.typeDefinition,
      }]
    }
  });

  const returnType = functionCallSig.getReturnType();
  const returnTypeResult = deriveSchemaTypeForTsType(unwrapPromiseType(returnType, context.typeChecker) ?? returnType, [{segmentType: "FunctionReturn", functionName}], context);
  let functionDefinition: schema.FunctionDefinition | null = null;
  if (returnTypeResult instanceof Err) {
    // Record the error, mark the function as broken so we discard the whole thing at the end
    issues.push(...returnTypeResult.error)
    functionIsBroken = true;
    functionDefinition = null;
  } else {
    issues.push(...returnTypeResult.data.warnings)
    functionDefinition = {
      description: functionDescription ? functionDescription : null,
      ndcKind: markedPureInJsDoc ? schema.FunctionNdcKind.Function : schema.FunctionNdcKind.Procedure,
      arguments: functionSchemaArguments,
      resultType: returnTypeResult.data.typeDefinition
    }
  }

  return {
    name: functionName,
    definition: !functionIsBroken ? functionDefinition : null,
    issues: issues
  }
}

const MAX_TYPE_DERIVATION_RECURSION = 20; // Better to abort than get into an infinite loop, this could be increased if required.

type TypePathSegment =
  { segmentType: "FunctionParameter", functionName: string, parameterName: string }
  | { segmentType: "FunctionReturn", functionName: string }
  | { segmentType: "ObjectProperty", typeName: string, propertyName: string }
  | { segmentType: "Array" }

function typePathToString(segments: TypePathSegment[]): string {
  return segments.map(typePathSegmentToString).join(", ")
}

function typePathSegmentToString(segment: TypePathSegment): string {
  switch (segment.segmentType) {
    case "FunctionParameter": return `function '${segment.functionName}' parameter '${segment.parameterName}'`
    case "FunctionReturn": return `function '${segment.functionName}' return value`
    case "ObjectProperty": return `type '${segment.typeName}' property '${segment.propertyName}'`
    case "Array": return `array type`
    default: return unreachable(segment["segmentType"])
  }
}

type DerivedSchemaType =
  { typeDefinition: schema.TypeDefinition, warnings: string[] }

function deriveSchemaTypeForTsType(tsType: ts.Type, typePath: TypePathSegment[], context: TypeDerivationContext, recursionDepth: number = 0): Result<DerivedSchemaType, string[]> {
  const typeRenderedName = context.typeChecker.typeToString(tsType);

  if (recursionDepth > MAX_TYPE_DERIVATION_RECURSION)
    throw new Error(`Schema inference validation exceeded depth ${MAX_TYPE_DERIVATION_RECURSION} for type ${typeRenderedName}`)

  if (unwrapPromiseType(tsType, context.typeChecker) !== undefined) {
    return new Err([`Promise types are not supported, but one was encountered in ${typePathToString(typePath)}.`]);
  }

  if (tsutils.isObjectType(tsType) && tsutils.isObjectFlagSet(tsType, ts.ObjectFlags.Class)) {
    return new Err([`Class types are not supported, but one was encountered in ${typePathToString(typePath)}`]);
  }

  if (tsutils.isIntrinsicVoidType(tsType)) {
    return new Err([`The void type is not supported, but one was encountered in ${typePathToString(typePath)}`]);
  }

  const schemaTypeResult =
    deriveSchemaTypeIfTsArrayType(tsType, typePath, context, recursionDepth)
    ?? deriveSchemaTypeIfScalarType(tsType, context)
    ?? deriveSchemaTypeIfNullableType(tsType, typePath, context, recursionDepth)
    ?? deriveSchemaTypeIfObjectType(tsType, typePath, context, recursionDepth);

  if (schemaTypeResult !== undefined)
    return schemaTypeResult;

  // We don't know how to deal with this type, so just make it an opaque scalar
  const typeName = generateTypeNameFromTypePath(typePath);
  context.scalarTypeDefinitions[typeName] = {};
  return new Ok({
    warnings: [`Unable to derive an NDC type for ${typePathToString(typePath)} (type: ${context.typeChecker.typeToString(tsType)}). Assuming that it is a scalar type.`],
    typeDefinition: { type: "named", kind: "scalar", name: typeName }
  });
}

function deriveSchemaTypeIfTsArrayType(tsType: ts.Type, typePath: TypePathSegment[], context: TypeDerivationContext, recursionDepth: number): Result<DerivedSchemaType, string[]> | undefined {
  if (context.typeChecker.isArrayType(tsType) && tsutils.isTypeReference(tsType)) {
    const typeArgs = context.typeChecker.getTypeArguments(tsType)
    if (typeArgs.length === 1) {
      const innerType = typeArgs[0]!;
      return deriveSchemaTypeForTsType(innerType, [...typePath, {segmentType: "Array"}], context, recursionDepth + 1)
        .map(innerTypeResult => ({ typeDefinition: { type: "array", elementType: innerTypeResult.typeDefinition }, warnings: innerTypeResult.warnings }));
    }
  }
}

function deriveSchemaTypeIfScalarType(tsType: ts.Type, context: TypeDerivationContext): Result<DerivedSchemaType, string[]> | undefined {
  if (tsutils.isIntrinsicBooleanType(tsType)) {
    context.scalarTypeDefinitions["Boolean"] = {};
    return new Ok({ typeDefinition: { type: "named", kind: "scalar", name: "Boolean" }, warnings: [] });
  }
  if (tsutils.isIntrinsicStringType(tsType)) {
    context.scalarTypeDefinitions["String"] = {};
    return new Ok({ typeDefinition: { type: "named", kind: "scalar", name: "String" }, warnings: [] });
  }
  if (tsutils.isIntrinsicNumberType(tsType)) {
    context.scalarTypeDefinitions["Float"] = {};
    return new Ok({ typeDefinition: { type: "named", kind: "scalar", name: "Float" }, warnings: [] });
  }
}

function deriveSchemaTypeIfNullableType(tsType: ts.Type, typePath: TypePathSegment[], context: TypeDerivationContext, recursionDepth: number): Result<DerivedSchemaType, string[]> | undefined {
  const notNullableResult = unwrapNullableType(tsType);
  if (notNullableResult !== null) {
    const [notNullableType, nullOrUndefinability] = notNullableResult;
    return deriveSchemaTypeForTsType(notNullableType, typePath, context, recursionDepth + 1)
      .map(notNullableTypeResult => ({ typeDefinition: { type: "nullable", underlyingType: notNullableTypeResult.typeDefinition, nullOrUndefinability }, warnings: notNullableTypeResult.warnings }))
  }
}

function deriveSchemaTypeIfObjectType(tsType: ts.Type, typePath: TypePathSegment[], context: TypeDerivationContext, recursionDepth: number): Result<DerivedSchemaType, string[]> | undefined {
  const info = getObjectTypeInfo(tsType, typePath, context.typeChecker, context.functionsFilePath);
  if (info) {
    // Shortcut recursion if the type has already been named
    if (context.objectTypeDefinitions[info.generatedTypeName]) {
      return new Ok({ typeDefinition: { type: 'named', name: info.generatedTypeName, kind: "object" }, warnings: [] });
    }

    context.objectTypeDefinitions[info.generatedTypeName] = { properties: [] }; // Break infinite recursion

    const warnings: string[] = [];
    const propertyResults = Result.traverseAndCollectErrors(Array.from(info.members), ([propertyName, propertyType]) => {
      return deriveSchemaTypeForTsType(propertyType, [...typePath, { segmentType: "ObjectProperty", typeName: info.generatedTypeName, propertyName }], context, recursionDepth + 1)
        .map(propertyTypeResult => {
          warnings.push(...propertyTypeResult.warnings)
          return { propertyName: propertyName, type: propertyTypeResult.typeDefinition }
        });
    });

    return propertyResults.map(properties => {
      context.objectTypeDefinitions[info.generatedTypeName] = { properties }
      return { typeDefinition: { type: 'named', name: info.generatedTypeName, kind: "object" }, warnings }
    })
  }
}

function unwrapPromiseType(tsType: ts.Type, typeChecker: ts.TypeChecker): ts.Type | undefined {
  if (tsutils.isTypeReference(tsType) && tsType.getSymbol()?.getName() === "Promise") {
    const typeArgs = typeChecker.getTypeArguments(tsType)
    return typeArgs.length === 1
      ? typeArgs[0]
      : undefined; // This isn't a real Promise if it doesn't have exactly one type argument
  } else {
    return undefined; // Not a Promise
  }
}

function unwrapNullableType(ty: ts.Type): [ts.Type, schema.NullOrUndefinability] | null {
  if (!ty.isUnion()) return null;

  const isNullable = ty.types.find(tsutils.isIntrinsicNullType) !== undefined;
  const isUndefined = ty.types.find(tsutils.isIntrinsicUndefinedType) !== undefined;
  const nullOrUndefinability =
    isNullable
      ? ( isUndefined
          ? schema.NullOrUndefinability.AcceptsEither
          : schema.NullOrUndefinability.AcceptsNullOnly
        )
      : ( isUndefined
          ? schema.NullOrUndefinability.AcceptsUndefinedOnly
          : null
        );

  const typesWithoutNullAndUndefined = ty.types
    .filter(t => !tsutils.isIntrinsicNullType(t) && !tsutils.isIntrinsicUndefinedType(t));

  return typesWithoutNullAndUndefined.length === 1 && nullOrUndefinability
    ? [typesWithoutNullAndUndefined[0]!, nullOrUndefinability]
    : null;
}

type ObjectTypeInfo = {
  // The name of the type; it may be a generated name if it is an anonymous type, or if it from an external module
  generatedTypeName: string,
  // The member properties of the object type. The types are
  // concrete types after type parameter resolution
  members: Map<string, ts.Type>
}

// TODO: This can be vastly simplified when I yeet the name qualification stuff
function getObjectTypeInfo(tsType: ts.Type, typePath: TypePathSegment[], typeChecker: ts.TypeChecker, functionsFilePath: string): ObjectTypeInfo | null {
  // Anonymous object type - this covers:
  // - {a: number, b: string}
  // - type Bar = { test: string }
  // - type GenericBar<T> = { data: T }
  if (tsutils.isObjectType(tsType) && tsutils.isObjectFlagSet(tsType, ts.ObjectFlags.Anonymous)) {
    return {
      generatedTypeName: qualifyTypeName(tsType, typePath, tsType.aliasSymbol ? typeChecker.typeToString(tsType) : null, functionsFilePath),
      members: getMembers(tsType.getProperties(), typeChecker)
    }
  }
  // Interface type - this covers:
  // interface IThing { test: string }
  else if (tsutils.isObjectType(tsType) && tsutils.isObjectFlagSet(tsType, ts.ObjectFlags.Interface)) {
    return {
      generatedTypeName: tsType.getSymbol()?.name ?? generateTypeNameFromTypePath(typePath),
      members: getMembers(tsType.getProperties(), typeChecker)
    }
  }
  // Generic interface type - this covers:
  // interface IGenericThing<T> { data: T }
  else if (tsutils.isTypeReference(tsType) && tsutils.isObjectFlagSet(tsType.target, ts.ObjectFlags.Interface) && typeChecker.isArrayType(tsType) === false && tsType.getSymbol()?.getName() !== "Promise") {
    return {
      generatedTypeName: tsType.getSymbol()?.name ?? generateTypeNameFromTypePath(typePath),
      members: getMembers(tsType.getProperties(), typeChecker)
    }
  }
  // Intersection type - this covers:
  // - { num: number } & Bar
  // - type IntersectionObject = { wow: string } & Bar
  // - type GenericIntersectionObject<T> = { data: T } & Bar
  else if (tsutils.isIntersectionType(tsType)) {
    return {
      generatedTypeName: qualifyTypeName(tsType, typePath, tsType.aliasSymbol ? typeChecker.typeToString(tsType) : null, functionsFilePath),
      members: getMembers(tsType.getProperties(), typeChecker)
    }
  }

  return null;
}

function getMembers(propertySymbols: ts.Symbol[], typeChecker: ts.TypeChecker) {
  return new Map(
    propertySymbols.map(symbol => [symbol.name, typeChecker.getTypeOfSymbol(symbol)])
  )
}

function qualifyTypeName(tsType: ts.Type, typePath: TypePathSegment[], name: string | null, functionsFilePath: string): string {
  let symbol = tsType.getSymbol();
  if (!symbol && tsutils.isUnionOrIntersectionType(tsType)) {
    symbol = tsType.types[0]!.getSymbol();
  }
  if (!symbol) {
    throw new Error(`Couldn't find symbol for type at ${typePathToString(typePath)}`);
  }

  const locations = (symbol.declarations ?? []).map((d: ts.Declaration) => d.getSourceFile());
  for (const f of locations) {
    const where = f.fileName;
    const short = where.replace(path.dirname(functionsFilePath) + '/','').replace(/\.ts$/, '');

    const nameOrGeneratedName = name ?? generateTypeNameFromTypePath(typePath);

    // If the type is present in the entrypoint, don't qualify the name
    // If it is under the entrypoint's directory qualify with the subpath
    // Otherwise, use the minimum ancestor of the type's location to ensure non-conflict
    if (functionsFilePath === where) {
      return nameOrGeneratedName;
    } else if (short.length < where.length) {
      return `${gqlName(short)}_${nameOrGeneratedName}`;
    } else {
      throw new Error(`Unsupported location for type ${name ?? generateTypeNameFromTypePath(typePath)} in ${where}`);
    }
  }

  throw new Error(`Couldn't find any declarations for type ${name}`);
}

function generateTypeNameFromTypePath(typePath: TypePathSegment[]): string {
  return typePath.map(segment => {
    switch (segment.segmentType) {
      case "FunctionParameter": return `${segment.functionName}_arguments_${segment.parameterName}`
      case "FunctionReturn": return `${segment.functionName}_output`
      case "ObjectProperty": return `field_'${segment.propertyName}`
      case "Array": return `array`
      default: return unreachable(segment["segmentType"])
    }
  }).join("_");
}

function gqlName(n: string): string {
  // Construct a GraphQL complient name: https://spec.graphql.org/draft/#sec-Type-Name-Introspection
  // Check if this is actually required.
  return n.replace(/^[^a-zA-Z]/, '').replace(/[^0-9a-zA-Z]/g,'_');
}
