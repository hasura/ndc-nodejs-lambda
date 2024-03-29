import { describe, it } from "mocha";
import { assert } from "chai";
import { deriveSchema } from "../../../src/inference";
import { FunctionNdcKind, NullOrUndefinability } from "../../../src/schema";

describe("external dependencies", function() {
  it("use npm package", function() {
    const schema = deriveSchema(require.resolve("./use-npm-package.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {},
      functionsSchema: {
        scalarTypes: {
          String: { type: "built-in" },
        },
        objectTypes: {},
        functions: {
          "useImportedPackage": {
            ndcKind: FunctionNdcKind.Function,
            description: null,
            parallelDegree: null,
            arguments: [
              {
                argumentName: "s",
                description: null,
                type: {
                  name: "String",
                  kind: "scalar",
                  type: "named",
                }
              },
            ],
            resultType: {
              name: "String",
              kind: "scalar",
              type: "named",
            }
          }
        }
      }
    })
  });

  it("use postgres package", function() {
    const schema = deriveSchema(require.resolve("./use-postgres-package.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {},
      functionsSchema: {
        functions: {
          "insert_user": {
            ndcKind: FunctionNdcKind.Procedure,
            description: null,
            parallelDegree: null,
            arguments: [
              {
                argumentName: "user_name",
                description: null,
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "String"
                }
              }
            ],
            resultType: {
              type: "named",
              kind: "scalar",
              name: "JSON"
            }
          },
          "insert_todos": {
            ndcKind: FunctionNdcKind.Procedure,
            description: null,
            parallelDegree: null,
            arguments: [
              {
                argumentName: "user_id",
                description: null,
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "String"
                }
              },
              {
                argumentName: "todo",
                description: null,
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "String"
                }
              },
            ],
            resultType: {
              type: "named",
              kind: "scalar",
              name: "JSON"
            }
          },
          "delete_todos": {
            ndcKind: FunctionNdcKind.Procedure,
            description: null,
            parallelDegree: null,
            arguments: [
              {
                argumentName: "todo_id",
                description: null,
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "String"
                }
              }
            ],
            resultType: {
              type: "named",
              kind: "object",
              name: "delete_todos_output"
            }
          },
        },
        scalarTypes: {
          String: { type: "built-in" },
          JSON: { type: "built-in" },
        },
        objectTypes: {
          "delete_todos_output": {
            description: null,
            properties: [
              {
                propertyName: "error",
                description: null,
                type: {
                  nullOrUndefinability: NullOrUndefinability.AcceptsUndefinedOnly,
                  type: "nullable",
                  underlyingType: {
                    kind: "scalar",
                    name: "String",
                    type: "named",
                  }
                }
              },
              {
                propertyName: "result",
                description: null,
                type: {
                  nullOrUndefinability: NullOrUndefinability.AcceptsUndefinedOnly,
                  type: "nullable",
                  underlyingType: {
                    kind: "scalar",
                    name: "String",
                    type: "named",
                  }
                }
              }
            ],
            isRelaxedType: false,
          }
        },
      }
    })
  });
});
