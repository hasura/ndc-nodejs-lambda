import ts from "typescript";
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

function cloneTypeDerivationContext(context: TypeDerivationContext): TypeDerivationContext {
  return {
    objectTypeDefinitions: structuredClone(context.objectTypeDefinitions),
    scalarTypeDefinitions: structuredClone(context.scalarTypeDefinitions),
    typeChecker: context.typeChecker,
    functionsFilePath: context.functionsFilePath,
    ndcLambdaSdkModule: context.ndcLambdaSdkModule,
  };
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

  const sourceFileSymbol = typeChecker.getSymbolAtLocation(sourceFile) ?? throwError("sourceFile does not have a symbol");
  const functionDeclarations: [string, ts.FunctionDeclaration][] = typeChecker.getExportsOfModule(sourceFileSymbol).flatMap(exportedSymbol => {
    const declaration = exportedSymbol.getDeclarations()?.[0] ?? throwError("exported symbol does not have a declaration");

    // If exported via 'export { name } from "./imported"'
    if (ts.isExportSpecifier(declaration)) {
      const identifier = declaration.name ?? throwError("export declaration didn't have an identifier");
      const exportTarget = typeChecker.getExportSpecifierLocalTargetSymbol(declaration) ?? throwError("export specifier does not have a local target symbol");
      const exportTargetDeclaration = exportTarget.valueDeclaration ?? throwError("export target symbol does not have a value declaration");
      if (ts.isFunctionDeclaration(exportTargetDeclaration)) {
        return [[identifier.text, exportTargetDeclaration]];
      }
    }
    // If just a plain function export or exported via 'export * from "./imported"'
    else if (ts.isFunctionDeclaration(declaration)) {
      const identifier = declaration.name ?? throwError("function declaration didn't have an identifier");
      return [[identifier.text, declaration]];
    }

    return [];
  });

  for (const [exportedFunctionName, functionDeclaration] of functionDeclarations) {
    const result = deriveFunctionSchema(functionDeclaration, exportedFunctionName, typeDerivationContext);
    if (result instanceof Ok) {
      schemaFunctions[exportedFunctionName] = result.data;
    } else {
      functionIssues[exportedFunctionName] = result.error;
    }
  }

  const functionsSchema = {
    functions: schemaFunctions,
    objectTypes: typeDerivationContext.objectTypeDefinitions,
    scalarTypes: typeDerivationContext.scalarTypeDefinitions,
  };

  return [functionsSchema, functionIssues];
}

function deriveFunctionSchema(functionDeclaration: ts.FunctionDeclaration, exportedFunctionName: string, context: TypeDerivationContext): Result<schema.FunctionDefinition, string[]> {
  const functionIdentifier = functionDeclaration.name ?? throwError("Function didn't have an identifier");
  const functionSymbol = context.typeChecker.getSymbolAtLocation(functionIdentifier) ?? throwError(`Function '${exportedFunctionName}' didn't have a symbol`);
  const functionType = context.typeChecker.getTypeOfSymbolAtLocation(functionSymbol, functionDeclaration);

  const functionDescription = getDescriptionFromJsDoc(functionSymbol, context.typeChecker);
  const markedReadonlyInJsDoc = functionSymbol.getJsDocTags().find(e => e.name === "readonly") !== undefined;
  const allowRelaxedTypes = functionSymbol.getJsDocTags().find(e => e.name === "allowrelaxedtypes") !== undefined;
  const parallelDegreeResult = getParallelDegreeFromJsDoc(functionSymbol, markedReadonlyInJsDoc);

  const functionCallSig = functionType.getCallSignatures()[0] ?? throwError(`Function '${exportedFunctionName}' didn't have a call signature`)
  const functionSchemaArguments: Result<schema.ArgumentDefinition[], string[]> = Result.traverseAndCollectErrors(functionCallSig.getParameters(), paramSymbol => {
    const paramName = paramSymbol.getName();
    const paramDesc = ts.displayPartsToString(paramSymbol.getDocumentationComment(context.typeChecker)).trim();
    const paramType = context.typeChecker.getTypeOfSymbolAtLocation(paramSymbol, paramSymbol.valueDeclaration ?? throwError(`Function '${exportedFunctionName}' parameter '${paramName}' didn't have a value declaration`));
    const paramTypePath: schema.TypePathSegment[] = [{segmentType: "FunctionParameter", functionName: exportedFunctionName, parameterName: paramName}];

    return deriveSchemaTypeForTsType(paramType, paramTypePath, allowRelaxedTypes, context)
      .map(paramTypeResult => ({
        argumentName: paramName,
        description: paramDesc ? paramDesc : null,
        type: paramTypeResult,
      }));
  });

  const returnType = functionCallSig.getReturnType();
  const returnTypeResult = deriveSchemaTypeForTsType(unwrapPromiseType(returnType, context.typeChecker) ?? returnType, [{segmentType: "FunctionReturn", functionName: exportedFunctionName}], allowRelaxedTypes, context);

  return Result.collectErrors3(functionSchemaArguments, returnTypeResult, parallelDegreeResult)
    .map(([functionSchemaArgs, returnType, parallelDegree]) => ({
      description: functionDescription,
      ndcKind: markedReadonlyInJsDoc ? schema.FunctionNdcKind.Function : schema.FunctionNdcKind.Procedure,
      arguments: functionSchemaArgs,
      resultType: returnType,
      parallelDegree,
    }));
}

function getDescriptionFromJsDoc(symbol: ts.Symbol, typeChecker: ts.TypeChecker): string | null {
  const description = ts.displayPartsToString(symbol.getDocumentationComment(typeChecker)).trim()
  return description ? description : null;
}

function getParallelDegreeFromJsDoc(functionSymbol: ts.Symbol, functionIsReadonly: boolean): Result<number | null, string[]> {
  const parallelDegreeTag = functionSymbol.getJsDocTags().find(e => e.name === "paralleldegree");
  if (parallelDegreeTag === undefined) {
    return new Ok(null);
  } else {
    if (!functionIsReadonly)
      return new Err(["The @paralleldegree JSDoc tag is only supported on functions also marked with the @readonly JSDoc tag"]);

    const tagSymbolDisplayPart = parallelDegreeTag.text?.[0]
    if (tagSymbolDisplayPart === undefined)
      return new Err(["The @paralleldegree JSDoc tag must specify an integer degree value"]);

    const tagText = tagSymbolDisplayPart.text.trim();
    const parallelDegreeInt = parseInt(tagText, 10);
    if (isNaN(parallelDegreeInt) || parallelDegreeInt <= 0)
      return new Err([`The @paralleldegree JSDoc tag must specify an integer degree value that is greater than 0. Current value: '${tagText}'`]);

    return new Ok(parallelDegreeInt);
  }
}

const MAX_TYPE_DERIVATION_RECURSION = 20; // Better to abort than get into an infinite loop, this could be increased if required.

function deriveSchemaTypeForTsType(tsType: ts.Type, typePath: schema.TypePathSegment[], allowRelaxedTypes: boolean, context: TypeDerivationContext, recursionDepth: number = 0): Result<schema.TypeReference, string[]> {
  const typeRenderedName = context.typeChecker.typeToString(tsType);

  if (recursionDepth > MAX_TYPE_DERIVATION_RECURSION)
    throw new Error(`Schema inference validation exceeded depth ${MAX_TYPE_DERIVATION_RECURSION} for type ${typeRenderedName}`)

  if (unwrapPromiseType(tsType, context.typeChecker) !== undefined) {
    return new Err([`Promise types are not supported, but one was encountered in ${schema.typePathToString(typePath)}.`]);
  }

  if (tsutils.isIntrinsicVoidType(tsType)) {
    return new Err([`The void type is not supported, but one was encountered in ${schema.typePathToString(typePath)}`]);
  }

  if (tsutils.isIntrinsicNeverType(tsType)) {
    return new Err([`The never type is not supported, but one was encountered in ${schema.typePathToString(typePath)}`]);
  }

  if (tsutils.isIntrinsicNonPrimitiveType(tsType)) {
    return new Err([`The object type is not supported, but one was encountered in ${schema.typePathToString(typePath)}`]);
  }

  if (tsutils.isIntrinsicNullType(tsType)) {
    return new Err([`The null type is not supported as a type literal used on its own, but one was encountered in ${schema.typePathToString(typePath)}`]);
  }

  if (tsutils.isIntrinsicUndefinedType(tsType)) {
    return new Err([`The undefined type is not supported as a type literal used on its own, but one was encountered in ${schema.typePathToString(typePath)}`]);
  }

  if (isFunctionType(tsType)) {
    return new Err([`Function types are not supported, but one was encountered in ${schema.typePathToString(typePath)} (type: ${context.typeChecker.typeToString(tsType)})`]);
  }

  if (isMapType(tsType)) {
    return new Err([`Map types are not supported, but one was encountered in ${schema.typePathToString(typePath)} (type: ${context.typeChecker.typeToString(tsType)})`]);
  }

  const schemaTypeResult =
    deriveSchemaTypeIfTsUnknownOrAny(tsType, typePath, allowRelaxedTypes, context)
    ?? deriveSchemaTypeIfTsTupleType(tsType, typePath, allowRelaxedTypes, context, recursionDepth)
    ?? deriveSchemaTypeIfTsArrayType(tsType, typePath, allowRelaxedTypes, context, recursionDepth)
    ?? deriveSchemaTypeIfScalarType(tsType, context)
    ?? deriveSchemaTypeIfNullableType(tsType, typePath, allowRelaxedTypes, context, recursionDepth)
    ?? deriveSchemaTypeIfObjectType(tsType, typePath, allowRelaxedTypes, context, recursionDepth)
    ?? rejectIfClassType(tsType, typePath, context) // This needs to be done after scalars, because JSONValue is a class
    ?? deriveSchemaTypeIfTsIndexSignatureType(tsType, typePath, allowRelaxedTypes, context, recursionDepth) // This needs to be done after scalars and classes, etc because some of those types do have index signatures (eg. strings)
    ?? deriveSchemaTypeIfTsUnionType(tsType, typePath, allowRelaxedTypes, context, recursionDepth); // This needs to be done after nullable types, since nullable types use unions, this catches everything else

  if (schemaTypeResult !== undefined)
    return schemaTypeResult;

  // We don't know how to deal with this type, so reject it with a generic error
  return new Err([`Unable to derive an NDC type for ${schema.typePathToString(typePath)} (type: ${context.typeChecker.typeToString(tsType)}).`]);
}

function deriveRelaxedTypeOrError(typeName: string, typePath: schema.TypePathSegment[], mkError: () => string, allowRelaxedTypes: boolean, context: TypeDerivationContext): Result<schema.TypeReference, string[]> {
  if (allowRelaxedTypes === false) {
    return new Err([mkError()]);
  }

  let scalarTypeDefinition = context.scalarTypeDefinitions[typeName];
  if (scalarTypeDefinition === undefined) {
    scalarTypeDefinition = { type: "relaxed-type", usedIn: [typePath] };
    context.scalarTypeDefinitions[typeName] = scalarTypeDefinition;
  } else if (scalarTypeDefinition.type === "relaxed-type") {
    scalarTypeDefinition.usedIn.push(typePath);
  } else {
    throw new Error(`Scalar type name conflict. Trying to create relaxed type '${typeName}' but it already exists as a ${scalarTypeDefinition.type}`)
  }

  return new Ok({ type: "named", kind: "scalar", name: typeName });
}

function deriveSchemaTypeIfTsUnknownOrAny(tsType: ts.Type, typePath: schema.TypePathSegment[], allowRelaxedTypes: boolean, context: TypeDerivationContext): Result<schema.TypeReference, string[]> | undefined {
  if (tsutils.isIntrinsicUnknownType(tsType)) {
    return deriveRelaxedTypeOrError("unknown", typePath, () => `The unknown type is not supported, but one was encountered in ${schema.typePathToString(typePath)}`, allowRelaxedTypes, context);
  }

  if (tsutils.isIntrinsicAnyType(tsType)) {
    return deriveRelaxedTypeOrError("any", typePath, () => `The any type is not supported, but one was encountered in ${schema.typePathToString(typePath)}`, allowRelaxedTypes, context);
  }
}

function deriveSchemaTypeIfTsTupleType(tsType: ts.Type, typePath: schema.TypePathSegment[], allowRelaxedTypes: boolean, context: TypeDerivationContext, recursionDepth: number): Result<schema.TypeReference, string[]> | undefined {
  if (tsutils.isTupleTypeReference(tsType)) {
    const typeName = context.typeChecker.typeToString(tsType);

    if (allowRelaxedTypes) {
      // Verify types in tuple are valid types
      const isolatedContext = cloneTypeDerivationContext(context); // Use an isolated context so we don't actually record any new scalar or object types while doing this, since this is going to end up as a relaxed type anyway
      const result = Result.traverseAndCollectErrors(tsType.typeArguments ?? [], (typeParameterTsType: ts.Type, index: number) => {
        return deriveSchemaTypeForTsType(typeParameterTsType, [...typePath, {segmentType: "TypeParameter", typeName, index}], allowRelaxedTypes, isolatedContext, recursionDepth + 1);
      });

      if (result instanceof Err) return new Err(result.error);
    }

    return deriveRelaxedTypeOrError(typeName, typePath, () => `Tuple types are not supported, but one was encountered in ${schema.typePathToString(typePath)} (type: ${typeName})`, allowRelaxedTypes, context);
  }
}

function rejectIfClassType(tsType: ts.Type, typePath: schema.TypePathSegment[], context: TypeDerivationContext): Result<schema.TypeReference, string[]> | undefined {
  if (tsutils.isObjectType(tsType) && tsutils.isObjectFlagSet(tsType, ts.ObjectFlags.Class)) {
    return new Err([`Class types are not supported, but one was encountered in ${schema.typePathToString(typePath)} (type: ${context.typeChecker.typeToString(tsType)})`]);
  }
}

// Types with index signatures: ie '[x: T]: Y'
function deriveSchemaTypeIfTsIndexSignatureType(tsType: ts.Type, typePath: schema.TypePathSegment[], allowRelaxedTypes: boolean, context: TypeDerivationContext, recursionDepth: number): Result<schema.TypeReference, string[]> | undefined {
  const indexInfos = context.typeChecker.getIndexInfosOfType(tsType);
  if (indexInfos.length > 0) {
    const typeName = context.typeChecker.typeToString(tsType);

    if (allowRelaxedTypes) {
      // Verify the types used in the index signatures are valid
      const isolatedContext = cloneTypeDerivationContext(context); // Use an isolated context so we don't actually record any new scalar or object types while doing this, since this is going to end up as a relaxed type anyway
      const indexSignatureTypes = indexInfos.flatMap<[ts.Type, schema.TypePathSegment]>((indexInfo: ts.IndexInfo, sigIndex: number) => [
        [indexInfo.keyType, { segmentType: "IndexSignature", typeName, sigIndex, component: "key" }],
        [indexInfo.type, { segmentType: "IndexSignature", typeName, sigIndex, component: "value" }],
      ]);
      const result = Result.traverseAndCollectErrors(indexSignatureTypes, ([sigType, typePathSegment]) => {
        return deriveSchemaTypeForTsType(sigType, [...typePath, typePathSegment], allowRelaxedTypes, isolatedContext, recursionDepth + 1);
      });

      if (result instanceof Err) return new Err(result.error);
    }

    return deriveRelaxedTypeOrError(typeName, typePath, () => `Types with index signatures are not supported, but one was encountered in ${schema.typePathToString(typePath)} (type: ${typeName})`, allowRelaxedTypes, context);
  }
}

function deriveSchemaTypeIfTsUnionType(tsType: ts.Type, typePath: schema.TypePathSegment[], allowRelaxedTypes: boolean, context: TypeDerivationContext, recursionDepth: number): Result<schema.TypeReference, string[]> | undefined {
  if (tsType.isUnion()) {
    const typeName = context.typeChecker.typeToString(tsType);

    if (allowRelaxedTypes) {
      // Verify union options are valid types
      const isolatedContext = cloneTypeDerivationContext(context); // Use an isolated context so we don't actually record any new scalar or object types while doing this, since this is going to end up as a relaxed type anyway
      const result = Result.traverseAndCollectErrors(tsType.types, (memberTsType: ts.Type, memberIndex: number) => {
        return deriveSchemaTypeForTsType(memberTsType, [...typePath, {segmentType: "UnionMember", typeName, memberIndex}], allowRelaxedTypes, isolatedContext, recursionDepth + 1);
      });

      if (result instanceof Err) return new Err(result.error);
    }


    return deriveRelaxedTypeOrError(typeName, typePath, () => `Union types are not supported, but one was encountered in ${schema.typePathToString(typePath)} (type: ${typeName})`, allowRelaxedTypes, context);
  }
}

function deriveSchemaTypeIfTsArrayType(tsType: ts.Type, typePath: schema.TypePathSegment[], allowRelaxedTypes: boolean, context: TypeDerivationContext, recursionDepth: number): Result<schema.TypeReference, string[]> | undefined {
  if (context.typeChecker.isArrayType(tsType) && tsutils.isTypeReference(tsType)) {
    const typeArgs = context.typeChecker.getTypeArguments(tsType)
    if (typeArgs.length === 1) {
      const innerType = typeArgs[0]!;
      return deriveSchemaTypeForTsType(innerType, [...typePath, {segmentType: "Array"}], allowRelaxedTypes, context, recursionDepth + 1)
        .map(innerType => ({ type: "array", elementType: innerType }));
    }
  }
}

function deriveSchemaTypeIfScalarType(tsType: ts.Type, context: TypeDerivationContext): Result<schema.TypeReference, string[]> | undefined {
  if (tsutils.isIntrinsicBooleanType(tsType) || isBooleanUnionType(tsType)) {
    context.scalarTypeDefinitions[schema.BuiltInScalarTypeName.Boolean] = { type: "built-in" };
    return new Ok({ type: "named", kind: "scalar", name: schema.BuiltInScalarTypeName.Boolean });
  }
  if (tsutils.isBooleanLiteralType(tsType)) {
    context.scalarTypeDefinitions[schema.BuiltInScalarTypeName.Boolean] = { type: "built-in" };
    const literalValue = tsType.intrinsicName === "true" ? true : false; // Unfortunately the types lie, tsType.value is undefined here :(
    return new Ok({ type: "named", kind: "scalar", name: schema.BuiltInScalarTypeName.Boolean, literalValue: literalValue });
  }
  if (tsutils.isIntrinsicStringType(tsType)) {
    context.scalarTypeDefinitions[schema.BuiltInScalarTypeName.String] = { type: "built-in" };
    return new Ok({ type: "named", kind: "scalar", name: schema.BuiltInScalarTypeName.String });
  }
  if (tsutils.isStringLiteralType(tsType)) {
    context.scalarTypeDefinitions[schema.BuiltInScalarTypeName.String] = { type: "built-in" };
    return new Ok({ type: "named", kind: "scalar", name: schema.BuiltInScalarTypeName.String, literalValue: tsType.value });
  }
  if (tsutils.isIntrinsicNumberType(tsType)) {
    context.scalarTypeDefinitions[schema.BuiltInScalarTypeName.Float] = { type: "built-in" };
    return new Ok({ type: "named", kind: "scalar", name: schema.BuiltInScalarTypeName.Float });
  }
  if (tsutils.isNumberLiteralType(tsType)) {
    context.scalarTypeDefinitions[schema.BuiltInScalarTypeName.Float] = { type: "built-in" };
    return new Ok({ type: "named", kind: "scalar", name: schema.BuiltInScalarTypeName.Float, literalValue: tsType.value });
  }
  if (tsutils.isIntrinsicBigIntType(tsType)) {
    context.scalarTypeDefinitions[schema.BuiltInScalarTypeName.BigInt] = { type: "built-in" };
    return new Ok({ type: "named", kind: "scalar", name: schema.BuiltInScalarTypeName.BigInt });
  }
  if (tsutils.isBigIntLiteralType(tsType)) {
    context.scalarTypeDefinitions[schema.BuiltInScalarTypeName.BigInt] = { type: "built-in" };
    const literalValue = BigInt(`${tsType.value.negative ? "-" : ""}${tsType.value.base10Value}`);
    return new Ok({ type: "named", kind: "scalar", name: schema.BuiltInScalarTypeName.BigInt, literalValue: literalValue });
  }
  if (isDateType(tsType)) {
    context.scalarTypeDefinitions[schema.BuiltInScalarTypeName.DateTime] = { type: "built-in" };
    return new Ok({ type: "named", kind: "scalar", name: schema.BuiltInScalarTypeName.DateTime });
  }
  if (isJSONValueType(tsType, context.ndcLambdaSdkModule)) {
    context.scalarTypeDefinitions[schema.BuiltInScalarTypeName.JSON] = { type: "built-in" };
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

function isMapType(tsType: ts.Type): tsType is ts.TypeReference {
  const symbol = tsType.getSymbol()
  if (symbol === undefined) return false;
  return symbol.escapedName === "Map" && symbol.members?.has(ts.escapeLeadingUnderscores("keys")) === true && symbol.members?.has(ts.escapeLeadingUnderscores("values")) === true && symbol.members?.has(ts.escapeLeadingUnderscores("entries")) === true;
}

// Identifies the 'true | false' type (which is distinct from the 'boolean' type)
function isBooleanUnionType(tsType: ts.Type): boolean {
  if (!tsutils.isUnionType(tsType)) return false;

  return tsType.types.length === 2 && unionTypeContainsBothBooleanLiterals(tsType);
}

function unionTypeContainsBothBooleanLiterals(tsUnionType: ts.UnionType): boolean {
  return tsUnionType.types.find(tsType => tsutils.isBooleanLiteralType(tsType) && tsType.intrinsicName === "true") !== undefined
    && tsUnionType.types.find(tsType => tsutils.isBooleanLiteralType(tsType) && tsType.intrinsicName === "false") !== undefined;
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

function deriveSchemaTypeIfNullableType(tsType: ts.Type, typePath: schema.TypePathSegment[], allowRelaxedTypes: boolean, context: TypeDerivationContext, recursionDepth: number): Result<schema.TypeReference, string[]> | undefined {
  const notNullableResult = unwrapNullableType(tsType, context.typeChecker);
  if (notNullableResult !== null) {
    const [notNullableType, nullOrUndefinability] = notNullableResult;
    return deriveSchemaTypeForTsType(notNullableType, typePath, allowRelaxedTypes, context, recursionDepth + 1)
      .map(notNullableType => ({ type: "nullable", underlyingType: notNullableType, nullOrUndefinability }))
  }
}

function deriveSchemaTypeIfObjectType(tsType: ts.Type, typePath: schema.TypePathSegment[], allowRelaxedTypes: boolean, context: TypeDerivationContext, recursionDepth: number): Result<schema.TypeReference, string[]> | undefined {
  const info = getObjectTypeInfo(tsType, typePath, context.typeChecker, context.functionsFilePath);
  if (info) {
    const makeRelaxedTypesError : () => Result<schema.TypeReference, string[]> = () => new Err<schema.TypeReference, string[]>([`The object type '${info.generatedTypeName}' uses relaxed types and can only be used by a function marked with @allowrelaxedtypes. It was encountered in ${schema.typePathToString(typePath)}`]);

    // Short-circuit recursion if the type has already been named
    const existingType = context.objectTypeDefinitions[info.generatedTypeName];
    if (existingType) {
      if (allowRelaxedTypes === false && existingType.isRelaxedType)
        return makeRelaxedTypesError();

      return new Ok({ type: 'named', name: info.generatedTypeName, kind: "object" });
    }

    context.objectTypeDefinitions[info.generatedTypeName] = { properties: [], description: null, isRelaxedType: false }; // Break infinite recursion

    return Result.traverseAndCollectErrors(Array.from(info.properties), ([propertyName, propertyInfo]) => {
      return deriveSchemaTypeForTsType(propertyInfo.tsType, [...typePath, { segmentType: "ObjectProperty", typeName: info.generatedTypeName, propertyName }], allowRelaxedTypes, context, recursionDepth + 1)
        .map(propertyType => ({ propertyName: propertyName, type: propertyType, description: propertyInfo.description }));
    })
    .bind(propertyResults => {
      const isRelaxedType = propertyResults.some(propDef => isTypeReferenceARelaxedType(propDef.type, context));
      if (allowRelaxedTypes === false && isRelaxedType) {
        return makeRelaxedTypesError();
      }

      context.objectTypeDefinitions[info.generatedTypeName] = { properties: propertyResults, description: info.description, isRelaxedType }
      return new Ok({ type: 'named', name: info.generatedTypeName, kind: "object" } as const)
    })
    .onErr(_err => {
      delete context.objectTypeDefinitions[info.generatedTypeName]; // Remove the recursion short-circuit to allow other functions to try making this type again
    });
  }
}

function isTypeReferenceARelaxedType(typeReference: schema.TypeReference, context: TypeDerivationContext): boolean {
  switch (typeReference.type) {
    case "array":
      return isTypeReferenceARelaxedType(typeReference.elementType, context);
    case "nullable":
      return isTypeReferenceARelaxedType(typeReference.underlyingType, context);
    case "named":
      switch (typeReference.kind) {
        case "object":
          const objTypeDef = context.objectTypeDefinitions[typeReference.name] ?? throwError(`Unable to find object type '${typeReference.name}', which should have already been generated`);
          return objTypeDef.isRelaxedType;
        case "scalar":
          const scalarTypeDef = context.scalarTypeDefinitions[typeReference.name] ?? throwError(`Unable to find object type '${typeReference.name}', which should have already been generated`);
          return scalarTypeDef.type === "relaxed-type";
        default:
          return unreachable(typeReference["kind"]);
      }
    default:
      return unreachable(typeReference["type"]);
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

function unwrapNullableType(tsType: ts.Type, typeChecker: ts.TypeChecker): [ts.Type, schema.NullOrUndefinability] | null {
  if (!tsType.isUnion()) return null;

  const isNullable = tsType.types.find(tsutils.isIntrinsicNullType) !== undefined;
  const isUndefined = tsType.types.find(tsutils.isIntrinsicUndefinedType) !== undefined;
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

  const typesWithoutNullAndUndefined = tsType.types
    .filter(t => !tsutils.isIntrinsicNullType(t) && !tsutils.isIntrinsicUndefinedType(t));

  // The case where one type is unioned with either or both of null and undefined
  if (typesWithoutNullAndUndefined.length === 1 && nullOrUndefinability) {
    return [typesWithoutNullAndUndefined[0]!, nullOrUndefinability];
  }
  // The weird edge case where null or undefined is unioned with both 'true' and 'false'
  // We simplify this to being unioned with 'boolean' instead
  else if (nullOrUndefinability && typesWithoutNullAndUndefined.length === 2 && unionTypeContainsBothBooleanLiterals(tsType)) {
    return [typeChecker.getBooleanType(), nullOrUndefinability];
  }
  else {
    return null;
  }
}

type PropertyTypeInfo = {
  tsType: ts.Type,
  description: string | null,
}

type ObjectTypeInfo = {
  // The name of the type; it may be a generated name if it is an anonymous type, or if it from an external module
  generatedTypeName: string,
  // The properties of the object type. The types are
  // concrete types after type parameter resolution
  properties: Map<string, PropertyTypeInfo>,
  // The JSDoc comment on the type
  description: string | null,
}

// TODO: This can be vastly simplified when I yeet the name qualification stuff
function getObjectTypeInfo(tsType: ts.Type, typePath: schema.TypePathSegment[], typeChecker: ts.TypeChecker, functionsFilePath: string): ObjectTypeInfo | null {
  // If the type has an index signature (ie '[x: T]: Y'), we don't support that (yet) so exclude it
  if (typeChecker.getIndexInfosOfType(tsType).length > 0) {
    return null;
  }

  const symbolForDocs = tsType.aliasSymbol ?? tsType.getSymbol();
  const description = symbolForDocs ? getDescriptionFromJsDoc(symbolForDocs, typeChecker) : null;

  // Anonymous object type - this covers:
  // - {a: number, b: string}
  // - type Bar = { test: string }
  // - type GenericBar<T> = { data: T }
  if (tsutils.isObjectType(tsType) && tsutils.isObjectFlagSet(tsType, ts.ObjectFlags.Anonymous)) {
    return {
      generatedTypeName: qualifyTypeName(tsType, typePath, tsType.aliasSymbol ? typeChecker.typeToString(tsType) : null, functionsFilePath),
      properties: getMembers(tsType.getProperties(), typeChecker),
      description,
    }
  }
  // Interface type - this covers:
  // interface IThing { test: string }
  // type AliasedIThing = IThing (the alias is erased by the compiler)
  else if (tsutils.isObjectType(tsType) && tsutils.isObjectFlagSet(tsType, ts.ObjectFlags.Interface)) {
    return {
      generatedTypeName: typeChecker.typeToString(tsType),
      properties: getMembers(tsType.getProperties(), typeChecker),
      description,
    }
  }
  // Generic interface type - this covers:
  // interface IGenericThing<T> { data: T }
  // type AliasedIGenericThing<T> = IGenericThing<T>
  // type AliasedClosedIGenericThing = IGenericThing<string>
  else if (tsutils.isTypeReference(tsType) && tsutils.isObjectFlagSet(tsType.target, ts.ObjectFlags.Interface) && typeChecker.isArrayType(tsType) === false && tsType.getSymbol()?.getName() !== "Promise") {
    return {
      generatedTypeName: typeChecker.typeToString(tsType),
      properties: getMembers(tsType.getProperties(), typeChecker),
      description,
    }
  }
  // Intersection type - this covers:
  // - { num: number } & Bar
  // - type IntersectionObject = { wow: string } & Bar
  // - type GenericIntersectionObject<T> = { data: T } & Bar
  else if (tsutils.isIntersectionType(tsType)) {
    return {
      generatedTypeName: qualifyTypeName(tsType, typePath, tsType.aliasSymbol ? typeChecker.typeToString(tsType) : null, functionsFilePath),
      properties: getMembers(tsType.getProperties(), typeChecker),
      description,
    }
  }

  return null;
}

function getMembers(propertySymbols: ts.Symbol[], typeChecker: ts.TypeChecker): Map<string, PropertyTypeInfo> {
  return new Map(
    propertySymbols.map(symbol => {
      const tsType = typeChecker.getTypeOfSymbol(symbol);
      const description = getDescriptionFromJsDoc(symbol, typeChecker);
      return [symbol.name, {tsType, description}]
    })
  )
}

function qualifyTypeName(tsType: ts.Type, typePath: schema.TypePathSegment[], name: string | null, functionsFilePath: string): string {
  let symbol = tsType.getSymbol();
  if (!symbol && tsutils.isUnionOrIntersectionType(tsType)) {
    symbol = tsType.types[0]!.getSymbol();
  }
  if (!symbol) {
    throw new Error(`Couldn't find symbol for type at ${schema.typePathToString(typePath)}`);
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

function generateTypeNameFromTypePath(typePath: schema.TypePathSegment[]): string {
  return typePath.map(segment => {
    switch (segment.segmentType) {
      case "FunctionParameter": return `${segment.functionName}_arguments_${segment.parameterName}`
      case "FunctionReturn": return `${segment.functionName}_output`
      case "ObjectProperty": return `field_${segment.propertyName}`
      case "Array": return `array`
      case "TypeParameter": return `typeparam_${segment.index}`
      case "IndexSignature": return `indexsig_${segment.sigIndex}_${segment.segmentType}`
      case "UnionMember": return `union_${segment.memberIndex}`
      default: return unreachable(segment["segmentType"])
    }
  }).join("_");
}

function gqlName(n: string): string {
  // Construct a GraphQL complient name: https://spec.graphql.org/draft/#sec-Type-Name-Introspection
  // Check if this is actually required.
  return n.replace(/^[^a-zA-Z]/, '').replace(/[^0-9a-zA-Z]/g,'_');
}
