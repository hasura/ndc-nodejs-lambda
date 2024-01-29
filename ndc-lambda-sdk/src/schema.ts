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
  resultType: TypeDefinition,
  parallelDegree: number | null,
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
  description: string | null,
  properties: ObjectPropertyDefinition[]
}

export type ObjectPropertyDefinition = {
  propertyName: string,
  description: string | null,
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

export type NamedTypeDefinition = NamedObjectTypeDefinition | NamedScalarTypeDefinition

export type NamedObjectTypeDefinition = {
  type: "named"
  name: string
  kind: "object"
}

export type NamedScalarTypeDefinition = CustomNamedScalarTypeDefinition | BuiltInScalarTypeDefinition

export type BuiltInScalarTypeDefinition = StringScalarTypeDefinition | FloatScalarTypeDefinition | BooleanScalarTypeDefinition | BigIntScalarTypeDefinition | DateTimeScalarTypeDefinition | JSONScalarTypeDefinition

export type CustomNamedScalarTypeDefinition = {
  type: "named"
  name: string
  kind: "scalar"
}

export type StringScalarTypeDefinition = {
  type: "named"
  name: BuiltInScalarTypeName.String
  kind: "scalar"
  literalValue?: string
}

export type FloatScalarTypeDefinition = {
  type: "named"
  name: BuiltInScalarTypeName.Float
  kind: "scalar"
  literalValue?: number
}

export type BooleanScalarTypeDefinition = {
  type: "named"
  name: BuiltInScalarTypeName.Boolean
  kind: "scalar"
  literalValue?: boolean
}

export type BigIntScalarTypeDefinition = {
  type: "named"
  name: BuiltInScalarTypeName.BigInt
  kind: "scalar"
  literalValue?: bigint
}

export type DateTimeScalarTypeDefinition = {
  type: "named"
  name: BuiltInScalarTypeName.DateTime
  kind: "scalar"
}

export type JSONScalarTypeDefinition = {
  type: "named"
  name: BuiltInScalarTypeName.JSON
  kind: "scalar"
}

// If there are compiler errors on this function, ensure that BuiltInScalarTypeDefinition has a type in
// its union for every BuiltInScalarTypeName enum member, and vice versa.
function builtInScalarTypeAssertionTest(a: BuiltInScalarTypeDefinition["name"], b: BuiltInScalarTypeName): void {
  a = b;
  b = a;
}

export enum NullOrUndefinability {
  AcceptsNullOnly = "AcceptsNullOnly",
  AcceptsUndefinedOnly = "AcceptsUndefinedOnly",
  AcceptsEither = "AcceptsEither",
}

export enum BuiltInScalarTypeName {
  String = "String",
  Float = "Float",
  Boolean = "Boolean",
  BigInt = "BigInt",
  DateTime = "DateTime",
  JSON = "JSON",
}

export class JSONValue {
  #value: unknown = undefined;
  #serializationError: Error | null | undefined;

  constructor(value: unknown)
  /** @internal */
  constructor(value: unknown, lazyValidate: boolean);
  constructor(value: unknown, lazyValidate: boolean = false) {
    if (value === undefined) {
      throw new Error("'value' cannot be undefined");
    }

    if (!lazyValidate) {
      this.#serializationError = this.#validate(value);
      if (this.#serializationError !== null && this.#serializationError !== undefined) {
        throw new Error("The provided value cannot be serialized to JSON", { cause: this.#serializationError });
      }
    }

    this.#value = value;
  }

  #validate(value: unknown): Error | null {
    try {
      JSON.stringify(value);
      return null;
    } catch (e) {
      return e as Error;
    }
  }

  get value(): unknown {
    return this.#value;
  }

  /**
   * @internal
   */
  get validationError(): Error | null {
    if (this.#serializationError === undefined) {
      this.#serializationError = this.#validate(this.#value);
    }
    return this.#serializationError;
  }
}

export function getNdcSchema(functionsSchema: FunctionsSchema): sdk.SchemaResponse {
  const functions = Object.entries(functionsSchema.functions);

  const objectTypes = mapObjectValues(functionsSchema.objectTypes, objDef => {
    return {
      fields: Object.fromEntries(objDef.properties.map(propDef => {
        const objField: sdk.ObjectField = {
          type: convertTypeDefinitionToSdkType(propDef.type),
          ...(propDef.description ? { description: propDef.description } : {})
        }
        return [propDef.propertyName, objField];
      })),
      ...(objDef.description ? { description: objDef.description } : {})
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

export function isTypeNameBuiltInScalar(typeName: string): typeName is BuiltInScalarTypeName {
  return Object.values(BuiltInScalarTypeName).find(builtInScalarTypeName => typeName === builtInScalarTypeName) !== undefined;
}

export function isBuiltInScalarTypeDefinition(typeDefinition: NamedScalarTypeDefinition): typeDefinition is BuiltInScalarTypeDefinition {
  return isTypeNameBuiltInScalar(typeDefinition.name);
}
