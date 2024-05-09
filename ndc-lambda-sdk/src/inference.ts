import ts from "typescript";
import * as tsutils from "ts-api-utils";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";
import { mapObjectValues, throwError, unreachable } from "./util";
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
    const sourceFile = program.getSourceFile(functionsFilePath);
    const projectRootDir = getProjectRootDirectory(functionsFilePath);
    if (!sourceFile) throw new Error(`'${functionsFilePath}' not returned as a TypeScript compiler source file`);
    const [functionsSchema, functionIssues] = deriveSchemaFromFunctions(sourceFile, projectRootDir, program.getTypeChecker(), ndcLambdaSdkModule);
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
  const fallbackTsConfig = path.resolve(require.resolve("@tsconfig/node20/tsconfig.json"));
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

function getProjectRootDirectory(functionsFilePath: string): string {
  let currentDir = path.dirname(functionsFilePath);
  while (true) {
    const packageJsonPath = path.join(currentDir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      return currentDir;
    }
    const parentDir = path.dirname(currentDir);

    // If we've reached the root and have found no package.json
    // just use the directory that the functions file is in
    if (parentDir === currentDir)
      return path.dirname(functionsFilePath);

    currentDir = parentDir;
  }
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
  customTypeNameRegistry: CustomTypeNameRegistry
  typeChecker: ts.TypeChecker
  ndcLambdaSdkModule: ts.ResolvedModuleFull,
}

/** Provides a source for where the type was discovered. */
type TypeSource = FunctionReturnTypeSource | SymbolTypeSource

/** The type came from the return type of a function signature */
type FunctionReturnTypeSource = {
  type: "FunctionReturn",
  callSignature: ts.Signature
}

/** The type came from something with a symbol (eg. function parameter, object property) */
type SymbolTypeSource = {
  type: "Symbol"
  symbol: ts.Symbol
}

function cloneTypeDerivationContext(context: TypeDerivationContext): TypeDerivationContext {
  return {
    objectTypeDefinitions: structuredClone(context.objectTypeDefinitions),
    scalarTypeDefinitions: structuredClone(context.scalarTypeDefinitions),
    customTypeNameRegistry: context.customTypeNameRegistry.clone(),
    typeChecker: context.typeChecker,
    ndcLambdaSdkModule: context.ndcLambdaSdkModule,
  };
}

function deriveSchemaFromFunctions(sourceFile: ts.SourceFile, projectRootDir: string, typeChecker: ts.TypeChecker, ndcLambdaSdkModule: ts.ResolvedModuleFull): [schema.FunctionsSchema, FunctionIssues] {
  const typeDerivationContext: TypeDerivationContext = {
    objectTypeDefinitions: {},
    scalarTypeDefinitions: {},
    customTypeNameRegistry: new CustomTypeNameRegistry(),
    typeChecker,
    ndcLambdaSdkModule
  }
  const schemaFunctions: schema.FunctionDefinitions = {};
  const functionIssues: FunctionIssues = {};

  const sourceFileSymbol = typeChecker.getSymbolAtLocation(sourceFile) ?? throwError("sourceFile does not have a symbol");
  const functionDeclarations: [string, ts.FunctionDeclaration][] = typeChecker.getExportsOfModule(sourceFileSymbol).flatMap(exportedSymbol => {
    const declaration = exportedSymbol.getDeclarations()?.[0] ?? throwError("exported symbol does not have a declaration");

    // If exported via 'export { name } from "./imported"'
    // or 'import { name } from "./imported"; export { name }'
    if (ts.isExportSpecifier(declaration)) {
      const identifier = declaration.name ?? throwError("export declaration didn't have an identifier");
      const exportTarget = typeChecker.getExportSpecifierLocalTargetSymbol(declaration) ?? throwError("export specifier does not have a local target symbol");
      const exportTargetDeclaration =
        exportTarget.valueDeclaration // 'export { name } from "./imported"'
        ?? typeChecker.getAliasedSymbol(exportTarget).valueDeclaration // 'import { name } from "./imported"; export { name }'
        ?? throwError("export target symbol does not have a value declaration");
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

  const finalTypeNames = typeDerivationContext.customTypeNameRegistry.determineFinalTypeNames(projectRootDir, typeChecker);
  const finalFunctionSchema = applyFinalTypeNamesToFunctionsSchema(functionsSchema, finalTypeNames);

  return [finalFunctionSchema, functionIssues];
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

    return deriveSchemaTypeForTsType(paramType, { type: "Symbol", symbol: paramSymbol }, paramTypePath, allowRelaxedTypes, context)
      .map(paramTypeResult => ({
        argumentName: paramName,
        description: paramDesc ? paramDesc : null,
        type: paramTypeResult,
      }));
  });

  const returnType = functionCallSig.getReturnType();
  const unwrappedReturnType = unwrapPromiseType(returnType, context.typeChecker) ?? returnType;
  const returnTypeResult = deriveSchemaTypeForTsType(unwrappedReturnType, { type: "FunctionReturn", callSignature: functionCallSig }, [{segmentType: "FunctionReturn", functionName: exportedFunctionName}], allowRelaxedTypes, context);

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

function deriveSchemaTypeForTsType(tsType: ts.Type, typeSource: TypeSource, typePath: schema.TypePathSegment[], allowRelaxedTypes: boolean, context: TypeDerivationContext): Result<schema.TypeReference, string[]> {
  const typeRenderedName = context.typeChecker.typeToString(tsType);

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
    deriveSchemaTypeIfTsUnknownOrAny(tsType, typeSource, typePath, allowRelaxedTypes, context)
    ?? deriveSchemaTypeIfTsTupleType(tsType, typeSource, typePath, allowRelaxedTypes, context)
    ?? deriveSchemaTypeIfTsArrayType(tsType, typeSource, typePath, allowRelaxedTypes, context)
    ?? deriveSchemaTypeIfBuiltInScalarType(tsType, context)
    ?? deriveSchemaTypeIfNullableType(tsType, typeSource, typePath, allowRelaxedTypes, context)
    ?? deriveSchemaTypeIfEnumType(tsType, typeSource, typePath, allowRelaxedTypes, context)
    ?? deriveSchemaTypeIfObjectType(tsType, typeSource, typePath, allowRelaxedTypes, context)
    ?? rejectIfClassType(tsType, typePath, context) // This needs to be done after scalars, because JSONValue is a class
    ?? deriveSchemaTypeIfTsIndexSignatureType(tsType, typeSource, typePath, allowRelaxedTypes, context) // This needs to be done after scalars and classes, etc because some of those types do have index signatures (eg. strings)
    ?? deriveSchemaTypeIfTsUnionType(tsType, typeSource, typePath, allowRelaxedTypes, context); // This needs to be done after nullable types, since nullable types use unions, this catches everything else

  if (schemaTypeResult !== undefined)
    return schemaTypeResult;

  // We don't know how to deal with this type, so reject it with a generic error
  return new Err([`Unable to derive an NDC type for ${schema.typePathToString(typePath)} (type: ${context.typeChecker.typeToString(tsType)}).`]);
}

function deriveRelaxedTypeOrError(preferredTypeName: string, tsType: ts.Type, typeSource: TypeSource, typePath: schema.TypePathSegment[], mkError: () => string, allowRelaxedTypes: boolean, context: TypeDerivationContext): Result<schema.TypeReference, string[]> {
  if (allowRelaxedTypes === false) {
    return new Err([mkError()]);
  }

  const uniqueTypeIdentifier = makeUniqueTypeIdentifier(tsType, typeSource, context.typeChecker)
  context.customTypeNameRegistry.registerUniqueType(uniqueTypeIdentifier, tsType, typeSource, preferredTypeName);

  let scalarTypeDefinition = context.scalarTypeDefinitions[uniqueTypeIdentifier];
  if (scalarTypeDefinition === undefined) {
    scalarTypeDefinition = { type: "relaxed-type", usedIn: [typePath] };
    context.scalarTypeDefinitions[uniqueTypeIdentifier] = scalarTypeDefinition;
  } else if (scalarTypeDefinition.type === "relaxed-type") {
    scalarTypeDefinition.usedIn.push(typePath);
  } else {
    throw new Error(`Scalar type name conflict. Trying to create relaxed type '${uniqueTypeIdentifier}' but it already exists as a ${scalarTypeDefinition.type}`)
  }

  return new Ok({ type: "named", kind: "scalar", name: uniqueTypeIdentifier });
}

function deriveSchemaTypeIfTsUnknownOrAny(tsType: ts.Type, typeSource: TypeSource, typePath: schema.TypePathSegment[], allowRelaxedTypes: boolean, context: TypeDerivationContext): Result<schema.TypeReference, string[]> | undefined {
  if (tsutils.isIntrinsicUnknownType(tsType)) {
    return deriveRelaxedTypeOrError("unknown", tsType, typeSource, typePath, () => `The unknown type is not supported, but one was encountered in ${schema.typePathToString(typePath)}`, allowRelaxedTypes, context);
  }

  if (tsutils.isIntrinsicAnyType(tsType)) {
    return deriveRelaxedTypeOrError("any", tsType, typeSource, typePath, () => `The any type is not supported, but one was encountered in ${schema.typePathToString(typePath)}`, allowRelaxedTypes, context);
  }
}

function deriveSchemaTypeIfTsTupleType(tsType: ts.Type, typeSource: TypeSource, typePath: schema.TypePathSegment[], allowRelaxedTypes: boolean, context: TypeDerivationContext): Result<schema.TypeReference, string[]> | undefined {
  if (tsutils.isTupleTypeReference(tsType)) {
    const typeName = context.typeChecker.typeToString(tsType);

    if (allowRelaxedTypes) {
      // Verify types in tuple are valid types
      const isolatedContext = cloneTypeDerivationContext(context); // Use an isolated context so we don't actually record any new scalar or object types while doing this, since this is going to end up as a relaxed type anyway
      const result = Result.traverseAndCollectErrors(tsType.typeArguments ?? [], (typeParameterTsType: ts.Type, index: number) => {
        return deriveSchemaTypeForTsType(typeParameterTsType, typeSource, [...typePath, {segmentType: "TypeParameter", typeName, index}], allowRelaxedTypes, isolatedContext);
      });

      if (result instanceof Err) return new Err(result.error);
    }

    return deriveRelaxedTypeOrError(typeName, tsType, typeSource, typePath, () => `Tuple types are not supported, but one was encountered in ${schema.typePathToString(typePath)} (type: ${typeName})`, allowRelaxedTypes, context);
  }
}

function rejectIfClassType(tsType: ts.Type, typePath: schema.TypePathSegment[], context: TypeDerivationContext): Result<schema.TypeReference, string[]> | undefined {
  if (tsutils.isObjectType(tsType) && tsutils.isObjectFlagSet(tsType, ts.ObjectFlags.Class)) {
    return new Err([`Class types are not supported, but one was encountered in ${schema.typePathToString(typePath)} (type: ${context.typeChecker.typeToString(tsType)})`]);
  }
}

// Types with index signatures: ie '[x: T]: Y'
function deriveSchemaTypeIfTsIndexSignatureType(tsType: ts.Type, typeSource: TypeSource, typePath: schema.TypePathSegment[], allowRelaxedTypes: boolean, context: TypeDerivationContext): Result<schema.TypeReference, string[]> | undefined {
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
        return deriveSchemaTypeForTsType(sigType, typeSource, [...typePath, typePathSegment], allowRelaxedTypes, isolatedContext);
      });

      if (result instanceof Err) return new Err(result.error);
    }

    return deriveRelaxedTypeOrError(typeName, tsType, typeSource, typePath, () => `Types with index signatures are not supported, but one was encountered in ${schema.typePathToString(typePath)} (type: ${typeName})`, allowRelaxedTypes, context);
  }
}

function deriveSchemaTypeIfTsUnionType(tsType: ts.Type, typeSource: TypeSource, typePath: schema.TypePathSegment[], allowRelaxedTypes: boolean, context: TypeDerivationContext): Result<schema.TypeReference, string[]> | undefined {
  if (tsType.isUnion()) {
    const typeName = context.typeChecker.typeToString(tsType);

    if (allowRelaxedTypes) {
      // Verify union options are valid types
      const isolatedContext = cloneTypeDerivationContext(context); // Use an isolated context so we don't actually record any new scalar or object types while doing this, since this is going to end up as a relaxed type anyway
      const result = Result.traverseAndCollectErrors(tsType.types, (memberTsType: ts.Type, memberIndex: number) => {
        return deriveSchemaTypeForTsType(memberTsType, typeSource, [...typePath, {segmentType: "UnionMember", typeName, memberIndex}], allowRelaxedTypes, isolatedContext);
      });

      if (result instanceof Err) return new Err(result.error);
    }

    return deriveRelaxedTypeOrError(typeName, tsType, typeSource, typePath, () => `Union types are not supported, but one was encountered in ${schema.typePathToString(typePath)} (type: ${typeName})`, allowRelaxedTypes, context);
  }
}

function deriveSchemaTypeIfTsArrayType(tsType: ts.Type, typeSource: TypeSource, typePath: schema.TypePathSegment[], allowRelaxedTypes: boolean, context: TypeDerivationContext): Result<schema.TypeReference, string[]> | undefined {
  if (context.typeChecker.isArrayType(tsType) && tsutils.isTypeReference(tsType)) {
    const typeArgs = context.typeChecker.getTypeArguments(tsType)
    if (typeArgs.length === 1) {
      const innerType = typeArgs[0]!;
      return deriveSchemaTypeForTsType(innerType, typeSource, [...typePath, {segmentType: "Array"}], allowRelaxedTypes, context)
        .map(innerType => ({ type: "array", elementType: innerType }));
    }
  }
}

function deriveSchemaTypeIfBuiltInScalarType(tsType: ts.Type, context: TypeDerivationContext): Result<schema.TypeReference, string[]> | undefined {
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

function deriveSchemaTypeIfEnumType(tsType: ts.Type, typeSource: TypeSource, typePath: schema.TypePathSegment[], allowRelaxedTypes: boolean, context: TypeDerivationContext): Result<schema.TypeReference, string[]> | undefined {
  if (tsutils.isUnionType(tsType) && !tsutils.isIntrinsicType(tsType) /* Block booleans */) {
    const typeName = context.typeChecker.typeToString(tsType);

    // Handles 'enum { First, Second }'
    if (tsutils.isTypeFlagSet(tsType, ts.TypeFlags.EnumLiteral)) {
      return deriveRelaxedTypeOrError(typeName, tsType, typeSource, typePath, () => `Enum types are not supported, but one was encountered in ${schema.typePathToString(typePath)} (type: ${typeName})`, allowRelaxedTypes, context);
    }

    // Handles `"first" | "second"`
    if (tsType.types.every(unionMemberType => tsutils.isLiteralType(unionMemberType))) {
      return deriveRelaxedTypeOrError(typeName, tsType, typeSource, typePath, () => `Literal union types are not supported, but one was encountered in ${schema.typePathToString(typePath)} (type: ${typeName})`, allowRelaxedTypes, context);
    }
  }
  // Handles computed single member enum types: 'enum { OneThing = "test".length }'
  else if (tsutils.isEnumType(tsType) && tsutils.isSymbolFlagSet(tsType.symbol, ts.SymbolFlags.EnumMember)) {
    const typeName = context.typeChecker.typeToString(tsType);
    return deriveRelaxedTypeOrError(typeName, tsType, typeSource, typePath, () => `Enum types are not supported, but one was encountered in ${schema.typePathToString(typePath)} (type: ${typeName})`, allowRelaxedTypes, context);
  }

  // Note that single member enum types: 'enum { OneThing }' are simplified by the type system
  // down to literal types (since they can only be a single thing) and are therefore supported via support
  // for literal types in scalars
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

  return tsType.types.length === 2
    && tsType.types.find(type => tsutils.isBooleanLiteralType(type) && type.intrinsicName === "true") !== undefined
    && tsType.types.find(type => tsutils.isBooleanLiteralType(type) && type.intrinsicName === "false") !== undefined;
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

function deriveSchemaTypeIfNullableType(tsType: ts.Type, typeSource: TypeSource, typePath: schema.TypePathSegment[], allowRelaxedTypes: boolean, context: TypeDerivationContext): Result<schema.TypeReference, string[]> | undefined {
  const notNullableResult = unwrapNullableType(tsType, context.typeChecker);
  if (notNullableResult !== null) {
    const [notNullableType, nullOrUndefinability] = notNullableResult;
    return deriveSchemaTypeForTsType(notNullableType, typeSource, typePath, allowRelaxedTypes, context)
      .map(notNullableType => ({ type: "nullable", underlyingType: notNullableType, nullOrUndefinability }))
  }
}

function deriveSchemaTypeIfObjectType(tsType: ts.Type, typeSource: TypeSource, typePath: schema.TypePathSegment[], allowRelaxedTypes: boolean, context: TypeDerivationContext): Result<schema.TypeReference, string[]> | undefined {
  const info = getObjectTypeInfo(tsType, typeSource, typePath, context.typeChecker);
  if (info) {
    const makeRelaxedTypesError : () => Result<schema.TypeReference, string[]> = () => new Err<schema.TypeReference, string[]>([`The object type '${info.preferredTypeName}' uses relaxed types and can only be used by a function marked with @allowrelaxedtypes. It was encountered in ${schema.typePathToString(typePath)}`]);

    // Short-circuit recursion if the type has already been named
    const existingType = context.objectTypeDefinitions[info.uniqueTypeIdentifier];
    if (existingType) {
      if (allowRelaxedTypes === false && existingType.isRelaxedType)
        return makeRelaxedTypesError();

      return new Ok({ type: 'named', name: info.uniqueTypeIdentifier, kind: "object" });
    }

    context.objectTypeDefinitions[info.uniqueTypeIdentifier] = { properties: [], description: null, isRelaxedType: false }; // Break infinite recursion

    return Result.traverseAndCollectErrors(Array.from(info.properties), ([propertyName, propertyInfo]) => {
      return deriveSchemaTypeForTsType(
          propertyInfo.tsType,
          { type: "Symbol", symbol: propertyInfo.symbol },
          [...typePath, { segmentType: "ObjectProperty", typeName: context.typeChecker.typeToString(tsType), preferredTypeName: info.preferredTypeName, propertyName }],
          allowRelaxedTypes, context
        )
        .map(propertyType => ({ propertyName: propertyName, type: propertyType, description: propertyInfo.description }));
    })
    .bind(propertyResults => {
      const isRelaxedType = propertyResults.some(propDef => isTypeReferenceARelaxedType(propDef.type, context));
      if (allowRelaxedTypes === false && isRelaxedType) {
        return makeRelaxedTypesError();
      }

      context.customTypeNameRegistry.registerUniqueType(info.uniqueTypeIdentifier, tsType, typeSource, info.preferredTypeName);

      context.objectTypeDefinitions[info.uniqueTypeIdentifier] = { properties: propertyResults, description: info.description, isRelaxedType }
      return new Ok({ type: 'named', name: info.uniqueTypeIdentifier, kind: "object" } as const)
    })
    .onErr(_err => {
      delete context.objectTypeDefinitions[info.uniqueTypeIdentifier]; // Remove the recursion short-circuit to allow other functions to try making this type again
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


  return nullOrUndefinability
    ? [typeChecker.getNonNullableType(tsType), nullOrUndefinability]
    : null;
}

type PropertyTypeInfo = {
  tsType: ts.Type,
  symbol: ts.Symbol,
  description: string | null,
}

type ObjectTypeInfo = {
  uniqueTypeIdentifier: UniqueTypeIdentifier,
  preferredTypeName: PreferredTypeName,
  // The properties of the object type. The types are
  // concrete types after type parameter resolution
  properties: Map<string, PropertyTypeInfo>,
  // The JSDoc comment on the type
  description: string | null,
}

// Anonymous object type - this covers:
// - {a: number, b: string}
// - type Bar = { test: string }
// - type GenericBar<T> = { data: T }
function isAnonymousObjectType(tsType: ts.Type): boolean {
  return tsutils.isObjectType(tsType) && tsutils.isObjectFlagSet(tsType, ts.ObjectFlags.Anonymous);
}

// Interface type - this covers:
// interface IThing { test: string }
// type AliasedIThing = IThing (the alias is erased by the compiler)
function isInterfaceType(tsType: ts.Type): boolean {
  return tsutils.isObjectType(tsType) && tsutils.isObjectFlagSet(tsType, ts.ObjectFlags.Interface);
}

// Generic interface type - this covers:
// interface IGenericThing<T> { data: T }
// type AliasedIGenericThing<T> = IGenericThing<T>
// type AliasedClosedIGenericThing = IGenericThing<string>
function isGenericInterfaceType(tsType: ts.Type, typeChecker: ts.TypeChecker): boolean {
  return tsutils.isTypeReference(tsType) && tsutils.isObjectFlagSet(tsType.target, ts.ObjectFlags.Interface)
    && typeChecker.isArrayType(tsType) === false && tsType.getSymbol()?.getName() !== "Promise"
}

function getObjectTypeInfo(tsType: ts.Type, typeSource: TypeSource, typePath: schema.TypePathSegment[], typeChecker: ts.TypeChecker): ObjectTypeInfo | null {
  // If the type has an index signature (ie '[x: T]: Y'), we don't support that (yet) so exclude it
  if (typeChecker.getIndexInfosOfType(tsType).length > 0) {
    return null;
  }

  // If it's none of the types we recognise as object types, exclude it
  if (!isAnonymousObjectType(tsType) && !isInterfaceType(tsType)
      && !isGenericInterfaceType(tsType, typeChecker) && !tsutils.isIntersectionType(tsType)) {
    return null;
  }

  const symbolForDocs = tsType.aliasSymbol ?? tsType.getSymbol();

  return {
    uniqueTypeIdentifier: makeUniqueTypeIdentifier(tsType, typeSource, typeChecker),
    preferredTypeName:
      // If the type is an anonymous type, and doesn't have an alias, generate a type name
      // otherwise just use the given type name
      (isAnonymousObjectType(tsType) || tsutils.isIntersectionType(tsType)) && !tsType.aliasSymbol
        ? generateTypeNameFromTypePath(typePath)
        : typeChecker.typeToString(tsType),
    properties: getMembers(tsType.getProperties(), typeChecker),
    description: symbolForDocs ? getDescriptionFromJsDoc(symbolForDocs, typeChecker) : null,
  }
}

function getMembers(propertySymbols: ts.Symbol[], typeChecker: ts.TypeChecker): Map<string, PropertyTypeInfo> {
  return new Map(
    propertySymbols.map(symbol => {
      const tsType = typeChecker.getTypeOfSymbol(symbol);
      const description = getDescriptionFromJsDoc(symbol, typeChecker);
      return [symbol.name, {tsType, symbol, description}]
    })
  )
}

function generateTypeNameFromTypePath(typePath: schema.TypePathSegment[]): string {
  if (typePath.length === 0) throw new Error("Unexpected empty type path when generating type name");

  const lastSegment = typePath[typePath.length - 1]!;
  switch (lastSegment.segmentType) {
    // Realistically, while we don't support union types, these are the segment types we're
    // likely to encounter in non-relaxed types.
    case "FunctionParameter": return `${lastSegment.functionName}_${lastSegment.parameterName}`
    case "FunctionReturn": return `${lastSegment.functionName}_output`
    case "ObjectProperty": return `${lastSegment.preferredTypeName}_${lastSegment.propertyName}`

    case "Array": return `array`
    case "TypeParameter": return `typeparam_${lastSegment.index}`
    case "IndexSignature": return `indexsig_${lastSegment.sigIndex}_${lastSegment.segmentType}`
    case "UnionMember": return `union_${lastSegment.memberIndex}`
    default: return unreachable(lastSegment["segmentType"])
  }
}

/** A string that uniquely identifies a particular TypeScript type */
type UniqueTypeIdentifier = string
/** The preferred name a TypeScript type would want to be named as */
type PreferredTypeName = string

type UniqueTypeInfo = {
  tsType: ts.Type
  typeSource: TypeSource
  preferredName: PreferredTypeName
}

class CustomTypeNameRegistry {
  _uniqueTypes: Record<UniqueTypeIdentifier, UniqueTypeInfo> = {};
  _preferredTypeNameContenders: Record<PreferredTypeName, UniqueTypeIdentifier[]> = {};

  registerUniqueType(uniqueTypeIdentifier: UniqueTypeIdentifier, tsType: ts.Type, typeSource: TypeSource, preferredTypeName: string): void {
    if (this._uniqueTypes[uniqueTypeIdentifier] !== undefined)
      return; // Already registered

    this._uniqueTypes[uniqueTypeIdentifier] = { preferredName: preferredTypeName, typeSource, tsType }
    const contenders = this._preferredTypeNameContenders[preferredTypeName] ?? [];
    contenders.push(uniqueTypeIdentifier);
    this._preferredTypeNameContenders[preferredTypeName] = contenders;
  }

  determineFinalTypeNames(projectRootDir: string, typeChecker: ts.TypeChecker): Record<UniqueTypeIdentifier, string> {
    const usedNames: Set<string> = new Set(Object.values(schema.BuiltInScalarTypeName)); // Built-in names are reserved already
    // This ensures that whatever name we've chosen is actually unique.
    // If it is not, we slap a number on the end until we find an unused name.
    // We try to avoid doing this by providing unique-ish names to begin with
    // but it may be possible to defeat that system, so we have this backup.
    const allocateName = (name: string) => {
      let proposedName = name;
      for (let index = 2; usedNames.has(proposedName); index++) {
        if (index >= Number.MAX_SAFE_INTEGER) throw new Error(`Unable to find an unused name for '${name}'. Reached MAX_SAFE_INTEGER`);
        proposedName = `${proposedName}${index}`;
      }
      usedNames.add(proposedName);
      return proposedName;
    }

    return mapObjectValues(this._uniqueTypes, (typeInfo, uniqueTypeName) => {
      const preferredNameContenders = this._preferredTypeNameContenders[typeInfo.preferredName] ?? [];
      const name = preferredNameContenders.length === 1
        ? typeInfo.preferredName
        : deriveFullyQualifiedName(typeInfo, projectRootDir, typeChecker)
      return allocateName(name);
    });
  }

  clone(): CustomTypeNameRegistry {
    const cloned = new CustomTypeNameRegistry()
    cloned._uniqueTypes = mapObjectValues(this._uniqueTypes, typeInfo => ({ ...typeInfo }));
    cloned._preferredTypeNameContenders = mapObjectValues(this._preferredTypeNameContenders, contenders => [...contenders]);
    return cloned;
  }
}

/**
 * Create a unique identifier for a type by forming a string describing the location of where the type is declared in code.
 * This is actually a massive pain because TypeScript is structurally typed, but NDC is nominally typed; ie NDC gives
 * every type a unique name, and TypeScript doesn't because it really only cares about type structure.
 * By creating a unique identifier for each type, we can track every place it is used and then give it a human-readable
 * NDC type name at the end, ensuring no two unique types have the same name (see 'CustomTypeNameRegistry').
 */
function makeUniqueTypeIdentifier(tsType: ts.Type, typeSource: TypeSource, typeChecker: ts.TypeChecker): UniqueTypeIdentifier {
  // 'TypeId' is used to encode a string that represents the type identity.
  // A string is necessary because we use it in map lookups and JS doesn't support using
  // deep equals when objects are used as keys.
  type TypeId = TypeWithDeclarationId | IntrinsicTypeId | LiteralTypeId | AnonymousObjectTypeId | AnonymousUnionTypeId | AnonymousIntersectionTypeId;
  type TypeWithDeclarationId = { t: "d", f: string, s: number, ta: TypeId[] }
  type IntrinsicTypeId = { t: "i", i: string }
  type LiteralTypeId = { t: "l-n", v: number } | { t: "l-s", v: string } | { t: "l-bi", v: ts.PseudoBigInt }
  type AnonymousObjectTypeId = { t: "o", p: [string, TypeId][] }
  type AnonymousUnionTypeId = { t: "u", u: TypeId[] }
  type AnonymousIntersectionTypeId = { t: "in", in: TypeId[] }

  const compareList = <T>(compare: (a: T, b: T) => number, listA: T[], listB: T[]): number => {
    const lengthCompare = listA.length - listB.length;
    if (lengthCompare !== 0) return lengthCompare;
    for (let i = 0; i < listA.length; i++) {
      const itemCompare = compare(listA[i]!, listB[i]!);
      if (itemCompare !== 0) return itemCompare;
    }
    return 0;
  }

  const compareTypeId = (typeIdA: TypeId, typeIdB: TypeId): number => {
    if (typeIdA.t === "d" && typeIdB.t == "d") {
      return typeIdA.f.localeCompare(typeIdB.f)
        || typeIdA.s - typeIdB.s
        || compareList(compareTypeId, typeIdA.ta, typeIdB.ta);
    } else if (typeIdA.t === "i" && typeIdB.t == "i") {
      return typeIdA.i.localeCompare(typeIdB.i);
    } else if (typeIdA.t === "l-n" && typeIdB.t == "l-n") {
      return typeIdA.v - typeIdB.v;
    } else if (typeIdA.t === "l-s" && typeIdB.t == "l-s") {
      return typeIdA.v.localeCompare(typeIdB.v);
    } else if (typeIdA.t === "l-bi" && typeIdB.t == "l-bi") {
      const aStr = `${typeIdA.v.negative ? "-" : ""}${typeIdA.v.base10Value}`;
      const bStr = `${typeIdB.v.negative ? "-" : ""}${typeIdB.v.base10Value}`;
      return aStr.localeCompare(bStr);
    } else if (typeIdA.t === "o" && typeIdB.t == "o") {
      return compareList(
        ([nameA, pTypeIdA], [nameB, pTypeIdB]) => nameA.localeCompare(nameB) || compareTypeId(pTypeIdA, pTypeIdB),
        typeIdA.p,
        typeIdB.p
      );
    } else if (typeIdA.t === "u" && typeIdB.t == "u") {
      return compareList(compareTypeId, typeIdA.u, typeIdB.u);
    } else if (typeIdA.t === "in" && typeIdB.t == "in") {
      return compareList(compareTypeId, typeIdA.in, typeIdB.in);
    } else {
      return typeIdA.t.localeCompare(typeIdB.t);
    }
  }

  const deriveTypeId = (tsType: ts.Type): TypeId => {
    // Intrinsics, such as string, number, any, etc
    if (tsutils.isIntrinsicType(tsType)) {
      return { t: "i", i: tsType.intrinsicName };
    }
    // Type literals (can be strings, numbers and bigints)
    if (tsType.isLiteral()) {
      if (typeof tsType.value === "string") {
        return { t: "l-s", v: tsType.value }
      } else if (typeof tsType.value === "number") {
        return { t: "l-n", v: tsType.value }
      } else {
        return { t: "l-bi", v: tsType.value }
      }
    }
    // Anonymous object type (identity is the object properties and their types)
    if (!tsType.aliasSymbol && isAnonymousObjectType(tsType)) {
      return {
        t: "o",
        p: tsType.getProperties()
            .map<[string, TypeId]>(propSymbol => [propSymbol.name, deriveTypeId(typeChecker.getTypeOfSymbol(propSymbol))])
            .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
      }
    }
    // Anonymous union types (identity is the sorted array of identities of the types that make up the union)
    if (!tsType.aliasSymbol && tsType.isUnion()) {
      return { t: "u", u: tsType.types.map(deriveTypeId).sort(compareTypeId) }; // We sort the types to ensure 'TypeA | TypeB' is the same as 'TypeA | TypeB'
    }
    // Anonymous intersection types (identity is the sorted array of identities of the types that make up the intersection)
    if (!tsType.aliasSymbol && tsType.isIntersection()) {
      return { t: "in", in: tsType.types.map(deriveTypeId).sort(compareTypeId) }; // We sort the types to ensure 'TypeA & TypeB' is the same as 'TypeB & TypeA'
    }
    const declaration = getDeclarationFromTypeOrTypeSource(tsType, typeSource, typeChecker);
    const typeArguments = tsType.aliasTypeArguments ?? (tsutils.isTypeReference(tsType) ? tsType.typeArguments : undefined) ?? [];
    const typeArgumentTypeIds = typeArguments.map(deriveTypeId);
    return {
      t: "d",
      f: declaration.getSourceFile().fileName,
      s: declaration.getStart(),
      ta: typeArgumentTypeIds,
    };
  }

  return JSON.stringify(deriveTypeId(tsType));
}

function getDeclarationFromTypeOrTypeSource(tsType: ts.Type, typeSource: TypeSource, typeChecker: ts.TypeChecker): ts.Declaration {
  const symbolFromType = tsType.aliasSymbol ?? tsType.getSymbol();
  if (symbolFromType) {
    return symbolFromType.getDeclarations()?.[0] ?? throwError(`Couldn't find declaration of symbol for type '${typeChecker.typeToString(tsType)}'`);
  } else {
    // Otherwise try to get the declaration of the source of the type's symbol
    // (eg. a function return value, a object property symbol or a function parameter symbol)
    switch (typeSource.type) {
      case "FunctionReturn":
        return typeSource.callSignature.getDeclaration();
      case "Symbol":
        return typeSource.symbol.getDeclarations()?.[0] ?? throwError(`Couldn't find declaration of type source symbol for type '${typeChecker.typeToString(tsType)}'`);
      default:
        return unreachable(typeSource["type"]);
    }
  }
}

function deriveFullyQualifiedName(uniqueTypeInfo: UniqueTypeInfo, projectRootDir: string, typeChecker: ts.TypeChecker): string {
  const declaration = getDeclarationFromTypeOrTypeSource(uniqueTypeInfo.tsType, uniqueTypeInfo.typeSource, typeChecker);
  const fileName = declaration.getSourceFile().fileName;
  const shortenedFileName =
    stripNodeModulesDirectory(fileName)
      ?? stripProjectRootPath(fileName, projectRootDir)
      ?? fileName;
  const moduleNameComponent = dropFileExtension(shortenedFileName).replaceAll(/[\\\/]/g, "_");
  return `${moduleNameComponent}_${uniqueTypeInfo.preferredName}`;
}

/**
 * Keeps the part of the path after the last node_modules directory
 *
 * `/functions/node_modules/@opentelemetry/api/build/src/metrics/Meter` ->
 * `@opentelemetry/api/build/src/metrics/Meter`
 */
function stripNodeModulesDirectory(filepath: string): string | null {
  const nodeModulesRegex = /node_modules[\\\/]/g;

  let lastIndex = null;
  let execResult = nodeModulesRegex.exec(filepath);
  while (execResult) {
    lastIndex = execResult.index + execResult[0].length;
    execResult = nodeModulesRegex.exec(filepath);
  }

  return lastIndex !== null
    ? filepath.substring(lastIndex)
    : null;
}

function stripProjectRootPath(filepath: string, projectRootDir: string): string | null {
  // Add a / to the end if it does not exist
  projectRootDir = projectRootDir.endsWith(path.sep) ? projectRootDir : projectRootDir + path.sep;
  return filepath.startsWith(projectRootDir)
    ? filepath.substring(projectRootDir.length)
    : null
}

function dropFileExtension(filePath: string): string {
  const extension = path.extname(filePath);
  return extension !== ""
    ? filePath.substring(0, filePath.length - extension.length)
    : filePath;
}

function applyFinalTypeNamesToFunctionsSchema(functionsSchema: schema.FunctionsSchema, finalTypeNames: Record<UniqueTypeIdentifier, string>): schema.FunctionsSchema {
  return {
    functions: mapObjectValues(functionsSchema.functions, definition => (
      {
        ...definition,
        arguments: definition.arguments.map(arg => ({ ...arg, type: applyFinalTypeName(arg.type, finalTypeNames) })),
        resultType: applyFinalTypeName(definition.resultType, finalTypeNames),
      }
    )),
    objectTypes: Object.fromEntries(Object.entries(functionsSchema.objectTypes).map(([objectTypeName, definition]) => {
      const newObjectTypeName = finalTypeNames[objectTypeName] ?? throwError(`Unable to find unique type name '${objectTypeName}'`);
      const newDefinition = {
        ...definition,
        properties: definition.properties.map(prop => ({ ...prop, type: applyFinalTypeName(prop.type, finalTypeNames) })),
      };
      return [newObjectTypeName, newDefinition]
    })),
    scalarTypes: Object.fromEntries(Object.entries(functionsSchema.scalarTypes).map(([scalarTypeName, definition]) => {
      const newScalarTypeName = schema.isTypeNameBuiltInScalar(scalarTypeName)
        ? scalarTypeName // Built-in types already have their final name
        : finalTypeNames[scalarTypeName] ?? throwError(`Unable to find unique type name '${scalarTypeName}'`);
      return [newScalarTypeName, definition]
    })),
  }
}

function applyFinalTypeName(typeReference: schema.TypeReference, finalTypeNames: Record<UniqueTypeIdentifier, string>): schema.TypeReference {
  switch (typeReference.type) {
    case "array":
      return { ...typeReference, elementType: applyFinalTypeName(typeReference.elementType, finalTypeNames) };
    case "nullable":
      return { ...typeReference, underlyingType: applyFinalTypeName(typeReference.underlyingType, finalTypeNames) };
    case "named":
      return schema.isTypeNameBuiltInScalar(typeReference.name)
        ? typeReference // Built-in types already have their final name
        : { ...typeReference, name: finalTypeNames[typeReference.name] ?? throwError(`Unable to find unique type name '${typeReference.name}'`) };
    default:
      return unreachable(typeReference["type"]);
  }
}
