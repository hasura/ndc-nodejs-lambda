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
