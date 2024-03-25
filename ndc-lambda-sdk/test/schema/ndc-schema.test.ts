import { describe } from "mocha";
import { FunctionNdcKind, FunctionsSchema, NullOrUndefinability, getNdcSchema } from "../../src/schema";
import { assert } from "chai";

describe("ndc schema", function() {
  it ("ndc schema generation", function () {
    const functionsSchema: FunctionsSchema = {
      functions: {
        "test_proc": {
          ndcKind: FunctionNdcKind.Procedure,
          description: "My procedure",
          parallelDegree: null,
          arguments: [
            {
              argumentName: "nullableParam",
              description: "A nullable param",
              type: {
                type: "nullable",
                nullOrUndefinability: NullOrUndefinability.AcceptsNullOnly,
                underlyingType: {
                  kind: "scalar",
                  name: "Float",
                  type: "named",
                },
              },
            },
          ],
          resultType: {
            type: "nullable",
            nullOrUndefinability: NullOrUndefinability.AcceptsNullOnly,
            underlyingType: {
              kind: "scalar",
              name: "BigInt",
              type: "named",
            }
          },
        },
        "test_func": {
          ndcKind: FunctionNdcKind.Function,
          description: "My function",
          parallelDegree: null,
          arguments: [
            {
              argumentName: "myObject",
              description: "My object param",
              type: {
                kind: "object",
                name: "MyObject",
                type: "named",
              },
            },
            {
              argumentName: "myRelaxedType",
              description: "My relaxed type param",
              type: {
                kind: "scalar",
                name: "MyRelaxedType",
                type: "named",
              },
            },
          ],
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
          description: "My Object Type",
          properties: [
            {
              propertyName: "boolean",
              description: "A boolean",
              type: {
                kind: "scalar",
                name: "Boolean",
                type: "named",
              },
            },
            {
              propertyName: "nullableDateTime",
              description: "A nullable date time",
              type: {
                type: "nullable",
                nullOrUndefinability: NullOrUndefinability.AcceptsNullOnly,
                underlyingType: {
                  kind: "scalar",
                  name: "DateTime",
                  type: "named",
                },
              },
            },
          ],
          isRelaxedType: false,
        },
      },
      scalarTypes: {
        "String": { type: "built-in" },
        "Boolean": { type: "built-in" },
        "Float": { type: "built-in" },
        "DateTime": { type: "built-in" },
        "BigInt": { type: "built-in" },
        "JSON": { type: "built-in" },
        "MyRelaxedType": {
          type: "relaxed-type",
          usedIn: [
            [
              {
                segmentType: "FunctionParameter",
                functionName: "test_func",
                parameterName: "myRelaxedType"
              }
            ]
          ]
        },
      },
    };

    const schemaResponse = getNdcSchema(functionsSchema)

    assert.deepStrictEqual(schemaResponse, {
      collections: [],
      functions: [
        {
          name: "test_func",
          description: "My function",
          arguments: {
            "myObject": {
              description: "My object param",
              type: {
                name: "MyObject",
                type: "named",
              },
            },
            "myRelaxedType": {
              description: "My relaxed type param",
              type: {
                name: "MyRelaxedType",
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
          description: "My procedure",
          arguments: {
            "nullableParam": {
              description: "A nullable param",
              type: {
                type: "nullable",
                underlying_type: {
                  name: "Float",
                  type: "named",
                },
              },
            },
          },
          result_type: {
            type: "nullable",
            underlying_type: {
              name: "BigInt",
              type: "named",
            }
          },
        }
      ],
      object_types: {
        "MyObject": {
          description: "My Object Type",
          fields: {
            "boolean": {
              description: "A boolean",
              type: {
                name: "Boolean",
                type: "named",
              },
            },
            "nullableDateTime": {
              description: "A nullable date time",
              type: {
                type: "nullable",
                underlying_type: {
                  name: "DateTime",
                  type: "named",
                },
              },
            },
          },
        },
      },
      scalar_types: {
        "String": {
          aggregate_functions: {},
          comparison_operators: {
            "_eq": { type: "equal" }
          }
        },
        "Boolean": {
          aggregate_functions: {},
          comparison_operators: {
            "_eq": { type: "equal" }
          }
        },
        "Float": {
          aggregate_functions: {},
          comparison_operators: {
            "_eq": { type: "equal" }
          }
        },
        "DateTime": {
          aggregate_functions: {},
          comparison_operators: {
            "_eq": { type: "equal" }
          }
        },
        "BigInt": {
          aggregate_functions: {},
          comparison_operators: {
            "_eq": { type: "equal" }
          }
        },
        "JSON": {
          aggregate_functions: {},
          comparison_operators: {}
        },
        "MyRelaxedType": {
          aggregate_functions: {},
          comparison_operators: {}
        },
      }
    });
  });
});
