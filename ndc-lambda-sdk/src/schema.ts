import * as sdk from "@hasura/ndc-sdk-typescript";
import { mapObjectValues, throwError, unreachable } from "./util";

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
  resultType: TypeReference,
  parallelDegree: number | null,
}

export enum FunctionNdcKind {
  Function = "Function",
  Procedure = "Procedure"
}

export type ArgumentDefinition = {
  argumentName: string,
  description: string | null,
  type: TypeReference
}

export type ObjectTypeDefinitions = {
  [objectTypeName: string]: ObjectTypeDefinition
}

export type ObjectTypeDefinition = {
  description: string | null,
  properties: ObjectPropertyDefinition[],
  isRelaxedType: boolean
}

export type ObjectPropertyDefinition = {
  propertyName: string,
  description: string | null,
  type: TypeReference,
}

export type ScalarTypeDefinitions = {
  [scalarTypeName: string]: ScalarTypeDefinition
}

export type ScalarTypeDefinition = BuiltInScalarTypeDefinition | RelaxedScalarTypeDefinition

export type BuiltInScalarTypeDefinition = {
  type: "built-in",
}

export type RelaxedScalarTypeDefinition = {
  type: "relaxed-type"
  usedIn: TypePathSegment[][]
}

export type TypeReference = ArrayTypeReference | NullableTypeReference | NamedTypeReference

export type ArrayTypeReference = {
  type: "array"
  elementType: TypeReference
}

export type NullableTypeReference = {
  type: "nullable",
  nullOrUndefinability: NullOrUndefinability
  underlyingType: TypeReference
}

export type NamedTypeReference = NamedObjectTypeReference | NamedScalarTypeReference

export type NamedObjectTypeReference = {
  type: "named"
  name: string
  kind: "object"
}

export type NamedScalarTypeReference = CustomNamedScalarTypeReference | BuiltInScalarTypeReference

export type BuiltInScalarTypeReference = StringScalarTypeReference | FloatScalarTypeReference | BooleanScalarTypeReference | BigIntScalarTypeReference | DateTimeScalarTypeReference | JSONScalarTypeReference

export type CustomNamedScalarTypeReference = {
  type: "named"
  name: string
  kind: "scalar"
}

export type StringScalarTypeReference = {
  type: "named"
  name: BuiltInScalarTypeName.String
  kind: "scalar"
  literalValue?: string
}

export type FloatScalarTypeReference = {
  type: "named"
  name: BuiltInScalarTypeName.Float
  kind: "scalar"
  literalValue?: number
}

export type BooleanScalarTypeReference = {
  type: "named"
  name: BuiltInScalarTypeName.Boolean
  kind: "scalar"
  literalValue?: boolean
}

export type BigIntScalarTypeReference = {
  type: "named"
  name: BuiltInScalarTypeName.BigInt
  kind: "scalar"
  literalValue?: bigint
}

export type DateTimeScalarTypeReference = {
  type: "named"
  name: BuiltInScalarTypeName.DateTime
  kind: "scalar"
}

export type JSONScalarTypeReference = {
  type: "named"
  name: BuiltInScalarTypeName.JSON
  kind: "scalar"
}

// If there are compiler errors on this function, ensure that BuiltInScalarTypeDefinition has a type in
// its union for every BuiltInScalarTypeName enum member, and vice versa.
function builtInScalarTypeAssertionTest(a: BuiltInScalarTypeReference["name"], b: BuiltInScalarTypeName): void {
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

export type TypePathSegment =
  { segmentType: "FunctionParameter", functionName: string, parameterName: string }
  | { segmentType: "FunctionReturn", functionName: string }
  | { segmentType: "ObjectProperty", typeName: string, preferredTypeName: string, propertyName: string }
  | { segmentType: "Array" }
  | { segmentType: "TypeParameter", typeName: string, index: number }
  | { segmentType: "IndexSignature", typeName: string, sigIndex: number, component: "key" | "value" }
  | { segmentType: "UnionMember", typeName: string, memberIndex: number }

export function typePathToString(segments: TypePathSegment[]): string {
  return segments.map(typePathSegmentToString).join(", ")
}

export function typePathSegmentToString(segment: TypePathSegment): string {
  switch (segment.segmentType) {
    case "FunctionParameter": return `function '${segment.functionName}' parameter '${segment.parameterName}'`
    case "FunctionReturn": return `function '${segment.functionName}' return value`
    case "ObjectProperty": return `type '${segment.typeName}' property '${segment.propertyName}'`
    case "Array": return `array type`
    case "TypeParameter": return `type '${segment.typeName}' type parameter index '${segment.index}'`
    case "IndexSignature": return `type '${segment.typeName}' type signature index '${segment.sigIndex}' ${segment.component} type`
    case "UnionMember": return `type '${segment.typeName}' union member index '${segment.memberIndex}'`
    default: return unreachable(segment["segmentType"])
  }
}

export function getNdcSchema(functionsSchema: FunctionsSchema): sdk.SchemaResponse {
  const functions = Object.entries(functionsSchema.functions);

  const objectTypes = mapObjectValues(functionsSchema.objectTypes, objDef => {
    return {
      fields: Object.fromEntries(objDef.properties.map(propDef => {
        const objField: sdk.ObjectField = {
          type: convertTypeReferenceToSdkType(propDef.type),
          ...(propDef.description ? { description: propDef.description } : {})
        }
        return [propDef.propertyName, objField];
      })),
      ...(objDef.description ? { description: objDef.description } : {})
    }
  });

  const scalarTypes: Record<string, sdk.ScalarType> = mapObjectValues(functionsSchema.scalarTypes, (scalarDef, scalarTypeName) => {
    switch (scalarDef.type) {
      case "built-in":
        return isTypeNameBuiltInScalar(scalarTypeName)
          ? convertBuiltInScalarTypeIntoSdkSchemaType(scalarTypeName)
          : throwError(`built-in scalar type with unexpected name: ${scalarTypeName}`);
      case "relaxed-type":
        return {
          aggregate_functions: {},
          comparison_operators: {},
        };
      default:
        return unreachable(scalarDef["type"]);
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

function convertTypeReferenceToSdkType(typeRef: TypeReference): sdk.Type {
  switch (typeRef.type) {
    case "array": return { type: "array", element_type: convertTypeReferenceToSdkType(typeRef.elementType) }
    case "nullable": return { type: "nullable", underlying_type: convertTypeReferenceToSdkType(typeRef.underlyingType) }
    case "named": return { type: "named", name: typeRef.name }
    default: return unreachable(typeRef["type"])
  }
}

function convertBuiltInScalarTypeIntoSdkSchemaType(typeName: BuiltInScalarTypeName): sdk.ScalarType {
  switch (typeName) {
    case BuiltInScalarTypeName.String: return {
      representation: { type: "string" },
      aggregate_functions: {},
      comparison_operators: { "_eq": { type: "equal" } },
    };
    case BuiltInScalarTypeName.Float: return {
      representation: { type: "float64" },
      aggregate_functions: {},
      comparison_operators: { "_eq": { type: "equal" } },
    };
    case BuiltInScalarTypeName.Boolean: return {
      representation: { type: "boolean" },
      aggregate_functions: {},
      comparison_operators: { "_eq": { type: "equal" } },
    };
    case BuiltInScalarTypeName.BigInt: return {
      representation: { type: "string" }, // NDC doesn't have a good representation for this type as at v0.1.2, so this is the best representation in the meantime
      aggregate_functions: {},
      comparison_operators: { "_eq": { type: "equal" } },
    };
    case BuiltInScalarTypeName.DateTime: return {
      representation: { type: "timestamp" },
      aggregate_functions: {},
      comparison_operators: { "_eq": { type: "equal" } },
    };
    case BuiltInScalarTypeName.JSON: return {
      representation: { type: "json" },
      aggregate_functions: {},
      comparison_operators: {},
    };
    default: return unreachable(typeName);
  }
}

function convertFunctionDefinitionToSdkSchemaType(function_name: string, definition: FunctionDefinition): sdk.FunctionInfo | sdk.ProcedureInfo {
  const args =
    definition.arguments
      .map(argDef =>
        [ argDef.argumentName,
          {
            type: convertTypeReferenceToSdkType(argDef.type),
            ...(argDef.description ? { description: argDef.description } : {}),
          }
        ]
      );

  return {
    name: function_name,
    arguments: Object.fromEntries(args),
    result_type: convertTypeReferenceToSdkType(definition.resultType),
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

export function printRelaxedTypesWarning(functionsSchema: FunctionsSchema) {
  const relaxedTypes = Object.entries(functionsSchema.scalarTypes).flatMap<[string, RelaxedScalarTypeDefinition]>(([scalarTypeName, definition]) => {
    return definition.type === "relaxed-type"
      ? [[scalarTypeName, definition]]
      : []
  });
  if (relaxedTypes.length > 0) {
    console.error("The following unsupported types have been defined as custom scalar types with no runtime validation ('relaxed types').")
    console.error("Use of relaxed types may cause runtime issues if invalid values are passed for these types.")
    console.error("It is recommended that you replace them with equivalent supported types so that your schema can be properly defined and validated, then remove the @allowrelaxedtypes tag from the functions involved.")
    for (const [scalarTypeName, definition] of relaxedTypes) {
      console.error(`  * '${scalarTypeName}' - used in:`);
      for (const usedIn of definition.usedIn) {
        console.error(`    * ${typePathToString(usedIn)}`);
      }
    }
  }
}

export function isTypeNameBuiltInScalar(typeName: string): typeName is BuiltInScalarTypeName {
  return Object.values(BuiltInScalarTypeName).find(builtInScalarTypeName => typeName === builtInScalarTypeName) !== undefined;
}

export function isBuiltInScalarTypeReference(typeReference: NamedScalarTypeReference): typeReference is BuiltInScalarTypeReference {
  return isTypeNameBuiltInScalar(typeReference.name);
}
