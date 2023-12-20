import * as sdk from "@hasura/ndc-sdk-typescript";
import { mapObjectValues, unreachable } from "./util";

export type FunctionsSchema = {
  functions: FunctionDefinitions
  objectTypes: ObjectTypeDefinitions
  scalarTypes: ScalarTypeDefinitions
}

export type FunctionDefinitions = {
  [functionName: string]: FunctionDefinition
}

export type FunctionDefinition = {
  ndcKind: FunctionNdcKind
  description: string | null,
  arguments: ArgumentDefinition[] // Function arguments are ordered
  resultType: TypeDefinition
}

export enum FunctionNdcKind {
  Function = "Function",
  Procedure = "Procedure"
}

export type ArgumentDefinition = {
  argumentName: string,
  description: string | null,
  type: TypeDefinition
}

export type ObjectTypeDefinitions = {
  [objectTypeName: string]: ObjectTypeDefinition
}

export type ObjectTypeDefinition = {
  properties: ObjectPropertyDefinition[]
}

export type ObjectPropertyDefinition = {
  propertyName: string,
  type: TypeDefinition,
}

export type ScalarTypeDefinitions = {
  [scalarTypeName: string]: ScalarTypeDefinition
}

export type ScalarTypeDefinition = Record<string, never> // Empty object, for now

export type TypeDefinition = ArrayTypeDefinition | NullableTypeDefinition | NamedTypeDefinition

export type ArrayTypeDefinition = {
  type: "array"
  elementType: TypeDefinition
}

export type NullableTypeDefinition = {
  type: "nullable",
  nullOrUndefinability: NullOrUndefinability
  underlyingType: TypeDefinition
}

export type NamedTypeDefinition = {
  type: "named"
  name: string
  kind: "scalar" | "object"
}

export enum NullOrUndefinability {
  AcceptsNullOnly = "AcceptsNullOnly",
  AcceptsUndefinedOnly = "AcceptsUndefinedOnly",
  AcceptsEither = "AcceptsEither",
}

export function getNdcSchema(functionsSchema: FunctionsSchema): sdk.SchemaResponse {
  const functions = Object.entries(functionsSchema.functions);

  const objectTypes = mapObjectValues(functionsSchema.objectTypes, objDef => {
    return {
      fields: Object.fromEntries(objDef.properties.map(propDef => [propDef.propertyName, { type: convertTypeDefinitionToSdkType(propDef.type)}]))
    }
  });

  const scalarTypes = mapObjectValues(functionsSchema.scalarTypes, _scalar_def => {
    return {
      aggregate_functions: {},
      comparison_operators: {},
    }
  })

  return {
    functions: functions
      .filter(([_, def]) => def.ndcKind === FunctionNdcKind.Function)
      .map(([name, def]) => convertFunctionDefinitionToSdkSchemaType(name, def)),
    procedures: functions
      .filter(([_, def]) => def.ndcKind === FunctionNdcKind.Procedure)
      .map(([name, def]) => convertFunctionDefinitionToSdkSchemaType(name, def)),
    collections: [],
    object_types: objectTypes,
    scalar_types: scalarTypes,
  }
}

function convertTypeDefinitionToSdkType(typeDef: TypeDefinition): sdk.Type {
  switch (typeDef.type) {
    case "array": return { type: "array", element_type: convertTypeDefinitionToSdkType(typeDef.elementType) }
    case "nullable": return { type: "nullable", underlying_type: convertTypeDefinitionToSdkType(typeDef.underlyingType) }
    case "named": return { type: "named", name: typeDef.name }
    default: return unreachable(typeDef["type"])
  }
}

function convertFunctionDefinitionToSdkSchemaType(function_name: string, definition: FunctionDefinition): sdk.FunctionInfo | sdk.ProcedureInfo {
  const args =
    definition.arguments
      .map(argDef =>
        [ argDef.argumentName,
          {
            type: convertTypeDefinitionToSdkType(argDef.type),
            ...(argDef.description ? { description: argDef.description } : {}),
          }
        ]
      );

  return {
    name: function_name,
    arguments: Object.fromEntries(args),
    result_type: convertTypeDefinitionToSdkType(definition.resultType),
    ...(definition.description ? { description: definition.description } : {}),
  }
}

export function printSchemaListing(functionNdcKind: FunctionNdcKind, functionDefinitions: FunctionDefinitions) {
  const functions = Object.entries(functionDefinitions).filter(([_, def]) => def.ndcKind === functionNdcKind);
  if (functions.length > 0) {
    console.error(``);
    console.error(`${functionNdcKind}s:`)
    for (const [functionName, functionDefinition] of functions) {
      const args = functionDefinition.arguments.join(', ');
      console.error(`* ${functionName}(${args})`);
    }
    console.error(``);
  }
}
