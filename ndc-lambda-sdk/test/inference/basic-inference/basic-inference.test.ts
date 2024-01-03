import { describe, it } from "mocha";
import { assert } from "chai";
import { deriveSchema } from "../../../src/inference";
import { FunctionNdcKind, NullOrUndefinability } from "../../../src/schema";

describe("basic inference", function() {
  it("simple types", function() {
    const schema = deriveSchema(require.resolve("./simple-types.ts"));

    assert.deepEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {},
      functionsSchema: {
        scalarTypes: {
          Float: {},
          String: {},
        },
        objectTypes: {},
        functions: {
          "hello": {
            ndcKind: FunctionNdcKind.Procedure,
            description: null,
            arguments: [],
            resultType: {
              name: "String",
              kind: "scalar",
              type: "named",
            }
          },
          "add": {
            ndcKind: FunctionNdcKind.Procedure,
            description: null,
            arguments: [
              {
                argumentName: "a",
                description: null,
                type: {
                  name: "Float",
                  kind: "scalar",
                  type: "named",
                }
              },
              {
                argumentName: "b",
                description: null,
                type: {
                  name: "Float",
                  kind: "scalar",
                  type: "named",
                }
              }
            ],
            resultType: {
              name: "Float",
              kind: "scalar",
              type: "named",
            }
          }
        }
      }
    })
  });

  it("complex return type", function() {
    const schema = deriveSchema(require.resolve("./complex-return-type.ts"));

    assert.deepEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {},
      functionsSchema: {
        functions: {
          "complex": {
            ndcKind: FunctionNdcKind.Procedure,
            description: null,
            arguments: [
              {
                argumentName: "a",
                description: null,
                type: {
                  name: "Float",
                  kind: "scalar",
                  type: "named",
                }
              },
              {
                argumentName: "b",
                description: null,
                type: {
                  name: "Float",
                  kind: "scalar",
                  type: "named",
                }
              },
              {
                argumentName: "c",
                description: null,
                type: {
                  type: "nullable",
                  nullOrUndefinability: NullOrUndefinability.AcceptsUndefinedOnly,
                  underlyingType: {
                    name: "String",
                    kind: "scalar",
                    type: "named",
                  }
                }
              }
            ],
            resultType: {
              name: "Result",
              kind: "object",
              type: "named",
            },
          }
        },
        objectTypes: {
          Result: {
            properties: [
              {
                propertyName: "num",
                type: {
                  name: "Float",
                  kind: "scalar",
                  type: "named",
                },
              },
              {
                propertyName: "str",
                type: {
                  name: "String",
                  kind: "scalar",
                  type: "named",
                },
              },
              {
                propertyName: "bod",
                type: {
                  name: "String",
                  kind: "scalar",
                  type: "named",
                },
              },
            ]
          },
        },
        scalarTypes: {
          Float: {},
          String: {},
        }
      }
    })
  })
});
