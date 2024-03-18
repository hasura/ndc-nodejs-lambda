import { describe, it } from "mocha";
import { assert } from "chai";
import { deriveSchema } from "../../../src/inference";
import { FunctionNdcKind, NullOrUndefinability } from "../../../src/schema";

describe("type naming", function() {
  it("imported types", function() {
    const schema = deriveSchema(require.resolve("./imported-types.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {},
      functionsSchema: {
        functions: {
          "npmTypeImport": {
            ndcKind: FunctionNdcKind.Function,
            description: null,
            parallelDegree: null,
            arguments: [],
            resultType: {
              name: "HelpContext",
              kind: "object",
              type: "named",
            },
          },
          "localTypeImport": {
            ndcKind: FunctionNdcKind.Function,
            description: null,
            parallelDegree: null,
            arguments: [],
            resultType: {
              name: "AnotherType",
              kind: "object",
              type: "named",
            },
          },
          "conflictWithLocalImport": {
            ndcKind: FunctionNdcKind.Procedure,
            description: null,
            parallelDegree: null,
            arguments: [],
            resultType: {
              name: "test_inference_type-naming_imported-types_Foo",
              kind: "object",
              type: "named",
            },
          },
          "conflictWithNpmImport": {
            ndcKind: FunctionNdcKind.Function,
            description: null,
            parallelDegree: null,
            arguments: [
              {
                argumentName: "myErrorOptions",
                description: null,
                type: {
                  type: "named",
                  kind: "object",
                  name: "test_inference_type-naming_imported-types_ErrorOptions"
                }
              },
            ],
            resultType: {
              name: "commander_typings_index.d_ErrorOptions",
              kind: "object",
              type: "named",
            },
          },
        },
        objectTypes: {
          "HelpContext": {
            description: null,
            properties: [
              {
                propertyName: "error",
                description: null,
                type: {
                  name: "Boolean",
                  kind: "scalar",
                  type: "named",
                },
              },
            ],
            isRelaxedType: false,
          },
          "AnotherType": {
            description: null,
            properties: [
              {
                propertyName: "prop",
                description: null,
                type: {
                  name: "String",
                  kind: "scalar",
                  type: "named",
                },
              },
            ],
            isRelaxedType: false,
          },
          "test_inference_type-naming_imported-types_Foo": {
            description: null,
            properties: [
              {
                propertyName: "x",
                description: null,
                type: {
                  name: "Boolean",
                  kind: "scalar",
                  type: "named",
                },
              },
              {
                propertyName: "y",
                description: null,
                type: {
                  name: "test_inference_type-naming_imported-types.dep_Foo",
                  kind: "object",
                  type: "named",
                },
              },
            ],
            isRelaxedType: false,
          },
          "test_inference_type-naming_imported-types.dep_Foo": {
            description: null,
            properties: [
              {
                propertyName: "a",
                description: null,
                type: {
                  name: "String",
                  kind: "scalar",
                  type: "named",
                },
              },
              {
                propertyName: "b",
                description: null,
                type: {
                  name: "Float",
                  kind: "scalar",
                  type: "named",
                },
              },
            ],
            isRelaxedType: false,
          },
          "test_inference_type-naming_imported-types_ErrorOptions": {
            description: null,
            properties: [
              {
                propertyName: "retval",
                description: null,
                type: {
                  name: "Float",
                  kind: "scalar",
                  type: "named",
                },
              },
            ],
            isRelaxedType: false,
          },
          "commander_typings_index.d_ErrorOptions": {
            description: null,
            properties: [
              {
                propertyName: "code",
                description: "an id string representing the error",
                type: {
                  type: "nullable",
                  nullOrUndefinability: NullOrUndefinability.AcceptsUndefinedOnly,
                  underlyingType: {
                    name: "String",
                    kind: "scalar",
                    type: "named",
                  },
                }
              },
              {
                propertyName: "exitCode",
                description: "suggested exit code which could be used with process.exit",
                type: {
                  type: "nullable",
                  nullOrUndefinability: NullOrUndefinability.AcceptsUndefinedOnly,
                  underlyingType: {
                    name: "Float",
                    kind: "scalar",
                    type: "named",
                  },
                },
              },
            ],
            isRelaxedType: false,
          },
        },
        scalarTypes: {
          Boolean: { type: "built-in" },
          Float: { type: "built-in" },
          String: { type: "built-in" },
        }
      }
    })
  });

  it("anonymous types", function() {
    const schema = deriveSchema(require.resolve("./anonymous-types.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {},
      functionsSchema: {
        functions: {
          "anonymousTypes": {
            ndcKind: FunctionNdcKind.Function,
            description: null,
            parallelDegree: null,
            arguments: [
              {
                argumentName: "dob",
                description: null,
                type: {
                  type: "named",
                  kind: "object",
                  name: "anonymousTypes_dob"
                }
              },
              {
                argumentName: "aliasedObjectType",
                description: null,
                type: {
                  type: "named",
                  kind: "object",
                  name: "AliasedObjectType"
                }
              },
              {
                argumentName: "stringGenericAliasedObjectType",
                description: null,
                type: {
                  type: "named",
                  kind: "object",
                  name: "GenericAliasedObjectType<string>"
                }
              },
              {
                argumentName: "numberGenericAliasedObjectType",
                description: null,
                type: {
                  type: "named",
                  kind: "object",
                  name: "GenericAliasedObjectType<number>"
                }
              }
            ],
            resultType: {
              type: "named",
              kind: "object",
              name: "anonymousTypes_output",
            },
          }
        },
        objectTypes: {
          "anonymousTypes_dob": {
            description: null,
            properties: [
              {
                propertyName: "year",
                description: null,
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "Float",
                },
              },
              {
                propertyName: "month",
                description: null,
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "Float",
                },
              },
              {
                propertyName: "day",
                description: null,
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "Float",
                },
              },
            ],
            isRelaxedType: false,
          },
          "AliasedObjectType": {
            description: null,
            properties: [
              {
                propertyName: "fullName",
                description: null,
                type: {
                  type: "named",
                  kind: "object",
                  name: "AliasedObjectType_fullName",
                },
              },
              {
                propertyName: "intersectionFullName",
                description: null,
                type: {
                  type: "named",
                  kind: "object",
                  name: "AliasedObjectType_intersectionFullName",
                },
              },
              {
                propertyName: "nestedType",
                description: null,
                type: {
                  type: "named",
                  kind: "object",
                  name: "AliasedObjectType_nestedType",
                },
              },
            ],
            isRelaxedType: false,
          },
          "AliasedObjectType_fullName": {
            description: null,
            properties: [
              {
                propertyName: "firstName",
                description: null,
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "String",
                },
              },
              {
                propertyName: "surname",
                description: null,
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "String",
                },
              },
            ],
            isRelaxedType: false,
          },
          "AliasedObjectType_intersectionFullName": {
            description: null,
            properties: [
              {
                propertyName: "firstName",
                description: null,
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "String",
                },
              },
              {
                propertyName: "surname",
                description: null,
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "String",
                },
              },
            ],
            isRelaxedType: false,
          },
          "AliasedObjectType_nestedType": {
            description: null,
            properties: [
              {
                propertyName: "coordinates",
                description: null,
                type: {
                  type: "named",
                  kind: "object",
                  name: "AliasedObjectType_nestedType_coordinates",
                },
              },
              {
                propertyName: "nestedFullName",
                description: null,
                type: {
                  type: "named",
                  kind: "object",
                  name: "AliasedObjectType_fullName",
                },
              },
              {
                propertyName: "nestedIntersectionFullName",
                description: null,
                type: {
                  type: "named",
                  kind: "object",
                  name: "AliasedObjectType_intersectionFullName",
                },
              },
            ],
            isRelaxedType: false,
          },
          "AliasedObjectType_nestedType_coordinates": {
            description: null,
            properties: [
              {
                propertyName: "x",
                description: null,
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "Float",
                },
              },
              {
                propertyName: "y",
                description: null,
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "Float",
                },
              },
            ],
            isRelaxedType: false,
          },
          "GenericAliasedObjectType<number>": {
            description: null,
            properties: [
              {
                propertyName: "data",
                description: null,
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "Float",
                },
              },
              {
                propertyName: "nestedAnonymous",
                description: null,
                type: {
                  type: "named",
                  kind: "object",
                  name: "GenericAliasedObjectType<number>_nestedAnonymous",
                },
              },
            ],
            isRelaxedType: false,
          },
          "GenericAliasedObjectType<number>_nestedAnonymous": {
            description: null,
            properties: [
              {
                propertyName: "prop",
                description: null,
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "Float",
                },
              },
            ],
            isRelaxedType: false,
          },
          "GenericAliasedObjectType<string>": {
            description: null,
            properties: [
              {
                propertyName: "data",
                description: null,
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "String",
                },
              },
              {
                propertyName: "nestedAnonymous",
                description: null,
                type: {
                  type: "named",
                  kind: "object",
                  name: "GenericAliasedObjectType<string>_nestedAnonymous",
                },
              },
            ],
            isRelaxedType: false,
          },
          "GenericAliasedObjectType<string>_nestedAnonymous": {
            description: null,
            properties: [
              {
                propertyName: "prop",
                description: null,
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "String",
                },
              },
            ],
            isRelaxedType: false,
          },
          "anonymousTypes_output": {
            description: null,
            properties: [
              {
                propertyName: "successful",
                description: null,
                type: {
                  name: "Boolean",
                  kind: "scalar",
                  type: "named",
                },
              },
            ],
            isRelaxedType: false,
          },
        },
        scalarTypes: {
          Boolean: { type: "built-in" },
          Float: { type: "built-in" },
          String: { type: "built-in" },
        }
      }
    })
  })
});
