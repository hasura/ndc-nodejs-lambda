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

type CompilerResults = {
  program: ts.Program,
  compilerDiagnostics: ts.Diagnostic[],
  ndcLambdaSdkModule: ts.ResolvedModuleFull
}

export function deriveSchema(functionsFilePath: string): SchemaDerivationResults {
  const programResult = createTsProgram(functionsFilePath)
  if (programResult instanceof Ok) {
    const {program, compilerDiagnostics, ndcLambdaSdkModule} = programResult.data;
    const sourceFile = program.getSourceFile(functionsFilePath)
    if (!sourceFile) throw new Error(`'${functionsFilePath}' not returned as a TypeScript compiler source file`);

    const [functionsSchema, functionIssues] = deriveSchemaFromFunctions(sourceFile, program.getTypeChecker(), ndcLambdaSdkModule);
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

function createTsProgram(functionsFilePath: string): Result<CompilerResults, ts.Diagnostic[]> {
  return loadTsConfig(functionsFilePath).bind(parsedCommandLine => {
    const compilerHost = ts.createCompilerHost(parsedCommandLine.options);
    const sdkModule = ts.resolveModuleName("@hasura/ndc-lambda-sdk", functionsFilePath, parsedCommandLine.options, compilerHost);
    if (sdkModule.resolvedModule === undefined) throw new Error("Unable to resolve module '@hasura/ndc-lambda-sdk'");
    const program = ts.createProgram([functionsFilePath], parsedCommandLine.options, compilerHost);
    const compilerDiagnostics = ts.getPreEmitDiagnostics(program);
    return compilerDiagnostics.find(d => d.category === ts.DiagnosticCategory.Error) === undefined
      ? new Ok({program, compilerDiagnostics: [...compilerDiagnostics], ndcLambdaSdkModule: sdkModule.resolvedModule})
      : new Err([...compilerDiagnostics]);
  })
}

function loadTsConfig(functionsFilePath: string): Result<ts.ParsedCommandLine, ts.Diagnostic[]> {
  const functionsDir = path.dirname(functionsFilePath);
  const userTsConfig = ts.findConfigFile(functionsDir, ts.sys.fileExists);
  // If the user doesn't have a tsconfig, use this one as a fallback. The TypeScript defaults are bad
  // (eg. strict and strictNullChecks is off by default)
  const fallbackTsConfig = path.resolve(require.resolve("@tsconfig/node18/tsconfig.json"));
  const configPath = userTsConfig ?? fallbackTsConfig;
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
  if (configFile.error) {
    return new Err([configFile.error])
  }

  // If we're using the fallback tsconfig, override the include path to point to the user's
  // functions directory, otherwise it will look in the fallback tsconfig's directory
  if (userTsConfig === undefined) {
    configFile.config.include = [path.join(functionsDir, "./**/*")];
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
  ndcLambdaSdkModule: ts.ResolvedModuleFull,
}

function deriveSchemaFromFunctions(sourceFile: ts.SourceFile, typeChecker: ts.TypeChecker, ndcLambdaSdkModule: ts.ResolvedModuleFull): [schema.FunctionsSchema, FunctionIssues] {
  const typeDerivationContext: TypeDerivationContext = {
    objectTypeDefinitions: {},
    scalarTypeDefinitions: {},
    typeChecker,
    functionsFilePath: sourceFile.fileName,
    ndcLambdaSdkModule
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
  const functionIdentifier = functionDeclaration.name ?? throwError("Function didn't have an identifier");
  const functionName = functionIdentifier.text
  const functionSymbol = context.typeChecker.getSymbolAtLocation(functionIdentifier) ?? throwError(`Function '${functionName}' didn't have a symbol`);
  const functionType = context.typeChecker.getTypeOfSymbolAtLocation(functionSymbol, functionDeclaration);

  const functionDescription = ts.displayPartsToString(functionSymbol.getDocumentationComment(context.typeChecker)).trim();
  const markedReadonlyInJsDoc = functionSymbol.getJsDocTags().find(e => e.name === "readonly") !== undefined;

  const functionCallSig = functionType.getCallSignatures()[0] ?? throwError(`Function '${functionName}' didn't have a call signature`)
  const functionSchemaArguments: Result<schema.ArgumentDefinition[], string[]> = Result.traverseAndCollectErrors(functionCallSig.getParameters(), paramSymbol => {
    const paramName = paramSymbol.getName();
    const paramDesc = ts.displayPartsToString(paramSymbol.getDocumentationComment(context.typeChecker)).trim();
    const paramType = context.typeChecker.getTypeOfSymbolAtLocation(paramSymbol, paramSymbol.valueDeclaration ?? throwError(`Function '${functionName}' parameter '${paramName}' didn't have a value declaration`));
    const paramTypePath: TypePathSegment[] = [{segmentType: "FunctionParameter", functionName, parameterName: paramName}];

    return deriveSchemaTypeForTsType(paramType, paramTypePath, context)
      .map(paramTypeResult => ({
        argumentName: paramName,
        description: paramDesc ? paramDesc : null,
        type: paramTypeResult,
      }));
  });

  const returnType = functionCallSig.getReturnType();
  const returnTypeResult = deriveSchemaTypeForTsType(unwrapPromiseType(returnType, context.typeChecker) ?? returnType, [{segmentType: "FunctionReturn", functionName}], context);

  const functionDefinition = Result.collectErrors(functionSchemaArguments, returnTypeResult)
    .map(([functionSchemaArgs, returnType]) => ({
      description: functionDescription ? functionDescription : null,
      ndcKind: markedReadonlyInJsDoc ? schema.FunctionNdcKind.Function : schema.FunctionNdcKind.Procedure,
      arguments: functionSchemaArgs,
      resultType: returnType
    }));

  if (functionDefinition instanceof Err) {
    return {
      name: functionName,
      definition: null,
      issues: functionDefinition.error
    }
  } else {
    return {
      name: functionName,
      definition: functionDefinition.data,
      issues: []
    }
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

function deriveSchemaTypeForTsType(tsType: ts.Type, typePath: TypePathSegment[], context: TypeDerivationContext, recursionDepth: number = 0): Result<schema.TypeDefinition, string[]> {
  const typeRenderedName = context.typeChecker.typeToString(tsType);

  if (recursionDepth > MAX_TYPE_DERIVATION_RECURSION)
    throw new Error(`Schema inference validation exceeded depth ${MAX_TYPE_DERIVATION_RECURSION} for type ${typeRenderedName}`)

  if (unwrapPromiseType(tsType, context.typeChecker) !== undefined) {
    return new Err([`Promise types are not supported, but one was encountered in ${typePathToString(typePath)}.`]);
  }

  if (tsutils.isIntrinsicVoidType(tsType)) {
    return new Err([`The void type is not supported, but one was encountered in ${typePathToString(typePath)}`]);
  }

  if (tsutils.isIntrinsicNeverType(tsType)) {
    return new Err([`The never type is not supported, but one was encountered in ${typePathToString(typePath)}`]);
  }

  if (tsutils.isIntrinsicNonPrimitiveType(tsType)) {
    return new Err([`The object type is not supported, but one was encountered in ${typePathToString(typePath)}`]);
  }

  if (tsutils.isIntrinsicUnknownType(tsType)) {
    return new Err([`The unknown type is not supported, but one was encountered in ${typePathToString(typePath)}`]);
  }

  if (tsutils.isIntrinsicAnyType(tsType)) {
    return new Err([`The any type is not supported, but one was encountered in ${typePathToString(typePath)}`]);
  }

  if (tsutils.isIntrinsicNullType(tsType)) {
    return new Err([`The null type is not supported as a type literal used on its own, but one was encountered in ${typePathToString(typePath)}`]);
  }

  if (tsutils.isIntrinsicUndefinedType(tsType)) {
    return new Err([`The undefined type is not supported as a type literal used on its own, but one was encountered in ${typePathToString(typePath)}`]);
  }

  if (tsutils.isTupleTypeReference(tsType)) {
    return new Err([`Tuple types are not supported, but one was encountered in ${typePathToString(typePath)} (type: ${context.typeChecker.typeToString(tsType)})`]);
  }

  if (isFunctionType(tsType)) {
    return new Err([`Function types are not supported, but one was encountered in ${typePathToString(typePath)} (type: ${context.typeChecker.typeToString(tsType)})`]);
  }

  if (isMapType(tsType)) {
    return new Err([`Map types are not supported, but one was encountered in ${typePathToString(typePath)} (type: ${context.typeChecker.typeToString(tsType)})`]);
  }

  const schemaTypeResult =
    deriveSchemaTypeIfTsArrayType(tsType, typePath, context, recursionDepth)
    ?? deriveSchemaTypeIfScalarType(tsType, context)
    ?? deriveSchemaTypeIfNullableType(tsType, typePath, context, recursionDepth)
    ?? deriveSchemaTypeIfObjectType(tsType, typePath, context, recursionDepth);

  if (schemaTypeResult !== undefined)
    return schemaTypeResult;

  // Types with index signatures: ie '[x: T]: Y'
  if (context.typeChecker.getIndexInfosOfType(tsType).length > 0) {
    return new Err([`Types with index signatures are not supported, but one was encountered in ${typePathToString(typePath)} (type: ${context.typeChecker.typeToString(tsType)})`]);
  }

  if (tsutils.isObjectType(tsType) && tsutils.isObjectFlagSet(tsType, ts.ObjectFlags.Class)) {
    return new Err([`Class types are not supported, but one was encountered in ${typePathToString(typePath)} (type: ${context.typeChecker.typeToString(tsType)})`]);
  }

  if (tsType.isUnion()) {
    return new Err([`Union types are not supported, but one was encountered in ${typePathToString(typePath)} (type: ${context.typeChecker.typeToString(tsType)})`]);
  }

  // We don't know how to deal with this type, so reject it with a generic error
  return new Err([`Unable to derive an NDC type for ${typePathToString(typePath)} (type: ${context.typeChecker.typeToString(tsType)}).`]);
}

function deriveSchemaTypeIfTsArrayType(tsType: ts.Type, typePath: TypePathSegment[], context: TypeDerivationContext, recursionDepth: number): Result<schema.TypeDefinition, string[]> | undefined {
  if (context.typeChecker.isArrayType(tsType) && tsutils.isTypeReference(tsType)) {
    const typeArgs = context.typeChecker.getTypeArguments(tsType)
    if (typeArgs.length === 1) {
      const innerType = typeArgs[0]!;
      return deriveSchemaTypeForTsType(innerType, [...typePath, {segmentType: "Array"}], context, recursionDepth + 1)
        .map(innerType => ({ type: "array", elementType: innerType }));
    }
  }
}

function deriveSchemaTypeIfScalarType(tsType: ts.Type, context: TypeDerivationContext): Result<schema.TypeDefinition, string[]> | undefined {
  if (tsutils.isIntrinsicBooleanType(tsType)) {
    context.scalarTypeDefinitions[schema.BuiltInScalarTypeName.Boolean] = {};
    return new Ok({ type: "named", kind: "scalar", name: schema.BuiltInScalarTypeName.Boolean });
  }
  if (tsutils.isBooleanLiteralType(tsType)) {
    context.scalarTypeDefinitions[schema.BuiltInScalarTypeName.Boolean] = {};
    const literalValue = tsType.intrinsicName === "true" ? true : false; // Unfortunately the types lie, tsType.value is undefined here :(
    return new Ok({ type: "named", kind: "scalar", name: schema.BuiltInScalarTypeName.Boolean, literalValue: literalValue });
  }
  if (tsutils.isIntrinsicStringType(tsType)) {
    context.scalarTypeDefinitions[schema.BuiltInScalarTypeName.String] = {};
    return new Ok({ type: "named", kind: "scalar", name: schema.BuiltInScalarTypeName.String });
  }
  if (tsutils.isStringLiteralType(tsType)) {
    context.scalarTypeDefinitions[schema.BuiltInScalarTypeName.String] = {};
    return new Ok({ type: "named", kind: "scalar", name: schema.BuiltInScalarTypeName.String, literalValue: tsType.value });
  }
  if (tsutils.isIntrinsicNumberType(tsType)) {
    context.scalarTypeDefinitions[schema.BuiltInScalarTypeName.Float] = {};
    return new Ok({ type: "named", kind: "scalar", name: schema.BuiltInScalarTypeName.Float });
  }
  if (tsutils.isNumberLiteralType(tsType)) {
    context.scalarTypeDefinitions[schema.BuiltInScalarTypeName.Float] = {};
    return new Ok({ type: "named", kind: "scalar", name: schema.BuiltInScalarTypeName.Float, literalValue: tsType.value });
  }
  if (tsutils.isIntrinsicBigIntType(tsType)) {
    context.scalarTypeDefinitions[schema.BuiltInScalarTypeName.BigInt] = {};
    return new Ok({ type: "named", kind: "scalar", name: schema.BuiltInScalarTypeName.BigInt });
  }
  if (tsutils.isBigIntLiteralType(tsType)) {
    context.scalarTypeDefinitions[schema.BuiltInScalarTypeName.BigInt] = {};
    const literalValue = BigInt(`${tsType.value.negative ? "-" : ""}${tsType.value.base10Value}`);
    return new Ok({ type: "named", kind: "scalar", name: schema.BuiltInScalarTypeName.BigInt, literalValue: literalValue });
  }
  if (isDateType(tsType)) {
    context.scalarTypeDefinitions[schema.BuiltInScalarTypeName.DateTime] = {};
    return new Ok({ type: "named", kind: "scalar", name: schema.BuiltInScalarTypeName.DateTime });
  }
  if (isJSONValueType(tsType, context.ndcLambdaSdkModule)) {
    context.scalarTypeDefinitions[schema.BuiltInScalarTypeName.JSON] = {};
    return new Ok({ type: "named", kind: "scalar", name: schema.BuiltInScalarTypeName.JSON });
  }
}

function isDateType(tsType: ts.Type): boolean {
  const symbol = tsType.getSymbol()
  if (symbol === undefined) return false;
  return symbol.escapedName === "Date" && symbol.members?.has(ts.escapeLeadingUnderscores("toISOString")) === true;
}

function isFunctionType(tsType: ts.Type): boolean {
  return tsType.getCallSignatures().length > 0 || tsType.getConstructSignatures().length > 0;
}

function isMapType(tsType: ts.Type): boolean {
  const symbol = tsType.getSymbol()
  if (symbol === undefined) return false;
  return symbol.escapedName === "Map" && symbol.members?.has(ts.escapeLeadingUnderscores("keys")) === true && symbol.members?.has(ts.escapeLeadingUnderscores("values")) === true && symbol.members?.has(ts.escapeLeadingUnderscores("entries")) === true;
}

function isJSONValueType(tsType: ts.Type, ndcLambdaSdkModule: ts.ResolvedModuleFull): boolean {
  // Must be a class type
  if (!tsutils.isObjectType(tsType) || !tsutils.isObjectFlagSet(tsType, ts.ObjectFlags.Class))
    return false;

  // Must be called JSONValue
  const symbol = tsType.getSymbol();
  if (symbol === undefined || symbol.escapedName !== "JSONValue") return false;

  // Must be declared in a file in the ndc-lambda-sdk's module directory (ie. this is _our_ JSONValue class)
  const sourceFile = symbol.getDeclarations()?.[0]?.getSourceFile();
  if (sourceFile === undefined) return false;
  const sdkDirectory = path.dirname(ndcLambdaSdkModule.resolvedFileName);
  return sourceFile.fileName.startsWith(sdkDirectory);
}

function deriveSchemaTypeIfNullableType(tsType: ts.Type, typePath: TypePathSegment[], context: TypeDerivationContext, recursionDepth: number): Result<schema.TypeDefinition, string[]> | undefined {
  const notNullableResult = unwrapNullableType(tsType);
  if (notNullableResult !== null) {
    const [notNullableType, nullOrUndefinability] = notNullableResult;
    return deriveSchemaTypeForTsType(notNullableType, typePath, context, recursionDepth + 1)
      .map(notNullableType => ({ type: "nullable", underlyingType: notNullableType, nullOrUndefinability }))
  }
}

function deriveSchemaTypeIfObjectType(tsType: ts.Type, typePath: TypePathSegment[], context: TypeDerivationContext, recursionDepth: number): Result<schema.TypeDefinition, string[]> | undefined {
  const info = getObjectTypeInfo(tsType, typePath, context.typeChecker, context.functionsFilePath);
  if (info) {
    // Short-circuit recursion if the type has already been named
    if (context.objectTypeDefinitions[info.generatedTypeName]) {
      return new Ok({ type: 'named', name: info.generatedTypeName, kind: "object" });
    }

    context.objectTypeDefinitions[info.generatedTypeName] = { properties: [] }; // Break infinite recursion

    const propertyResults = Result.traverseAndCollectErrors(Array.from(info.members), ([propertyName, propertyType]) => {
      return deriveSchemaTypeForTsType(propertyType, [...typePath, { segmentType: "ObjectProperty", typeName: info.generatedTypeName, propertyName }], context, recursionDepth + 1)
        .map(propertyType => ({ propertyName: propertyName, type: propertyType }));
    });

    if (propertyResults instanceof Ok) {
      context.objectTypeDefinitions[info.generatedTypeName] = { properties: propertyResults.data }
      return new Ok({ type: 'named', name: info.generatedTypeName, kind: "object" })
    } else {
      // Remove the recursion short-circuit to ensure errors are raised if this type is encountered again
      delete context.objectTypeDefinitions[info.generatedTypeName];
      return new Err(propertyResults.error);
    }
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
  // If the type has an index signature (ie '[x: T]: Y'), we don't support that (yet) so exclude it
  if (typeChecker.getIndexInfosOfType(tsType).length > 0) {
    return null;
  }

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
      case "ObjectProperty": return `field_${segment.propertyName}`
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
