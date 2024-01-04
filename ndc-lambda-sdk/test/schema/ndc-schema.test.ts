import { describe } from "mocha";
import { FunctionNdcKind, FunctionsSchema, NullOrUndefinability, getNdcSchema } from "../../src/schema";
import { assert } from "chai";

describe("ndc schema", function() {
  it ("ndc schema generation", function () {
    const functionsSchema: FunctionsSchema = {
      functions: {
        "test_proc": {
          arguments: [
            {
              argumentName: "nullableParam",
              description: null,
              type: {
                type: "nullable",
                nullOrUndefinability: NullOrUndefinability.AcceptsNullOnly,
                underlyingType: {
                  kind: "scalar",
                  name: "String",
                  type: "named",
                },
              },
            },
          ],
          description: null,
          ndcKind: FunctionNdcKind.Procedure,
          resultType: {
            type: "nullable",
            nullOrUndefinability: NullOrUndefinability.AcceptsNullOnly,
            underlyingType: {
              kind: "scalar",
              name: "String",
              type: "named",
            }
          },
        },
        "test_func": {
          arguments: [
            {
              argumentName: "myObject",
              description: null,
              type: {
                kind: "object",
                name: "MyObject",
                type: "named",
              },
            },
          ],
          description: null,
          ndcKind: FunctionNdcKind.Function,
          resultType: {
            type: "array",
            elementType: {
              kind: "scalar",
              name: "String",
              type: "named",
            }
          },
        },
      },
      objectTypes: {
        "MyObject": {
          properties: [
            {
              propertyName: "string",
              type: {
                kind: "scalar",
                name: "String",
                type: "named",
              },
            },
            {
              propertyName: "nullableString",
              type: {
                type: "nullable",
                nullOrUndefinability: NullOrUndefinability.AcceptsNullOnly,
                underlyingType: {
                  kind: "scalar",
                  name: "String",
                  type: "named",
                },
              },
            },
          ],
        },
      },
      scalarTypes: {
        String: {},
        test_arguments_unionWithNull: {},
      },
    };

    const schemaResponse = getNdcSchema(functionsSchema)

    assert.deepStrictEqual(schemaResponse, {
      collections: [],
      functions: [
        {
          name: "test_func",
          arguments: {
            "myObject": {
              type: {
                name: "MyObject",
                type: "named",
              },
            },
          },
          result_type: {
            type: "array",
            element_type: {
              name: "String",
              type: "named",
            }
          },
        },
      ],
      procedures: [
        {
          name: "test_proc",
          arguments: {
            "nullableParam": {
              type: {
                type: "nullable",
                underlying_type: {
                  name: "String",
                  type: "named",
                },
              },
            },
          },
          result_type: {
            type: "nullable",
            underlying_type: {
              name: "String",
              type: "named",
            }
          },
        }
      ],
      object_types: {
        "MyObject": {
          fields: {
            "string": {
              type: {
                name: "String",
                type: "named",
              },
            },
            "nullableString": {
              type: {
                type: "nullable",
                underlying_type: {
                  name: "String",
                  type: "named",
                },
              },
            },
          },
        },
      },
      scalar_types: {
        String: {
          aggregate_functions: {},
          comparison_operators: {}
        },
        test_arguments_unionWithNull: {
          aggregate_functions: {},
          comparison_operators: {}
        },
      }
    });
  });
});
