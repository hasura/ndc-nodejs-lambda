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
                  name: "String",
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
              name: "String",
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
              propertyName: "string",
              description: "A string",
              type: {
                kind: "scalar",
                name: "String",
                type: "named",
              },
            },
            {
              propertyName: "nullableString",
              description: "A nullable string",
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
          description: "My function",
          arguments: {
            "myObject": {
              description: "My object param",
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
          description: "My procedure",
          arguments: {
            "nullableParam": {
              description: "A nullable param",
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
          description: "My Object Type",
          fields: {
            "string": {
              description: "A string",
              type: {
                name: "String",
                type: "named",
              },
            },
            "nullableString": {
              description: "A nullable string",
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
