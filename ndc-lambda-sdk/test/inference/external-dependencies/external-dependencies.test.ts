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
          String: {},
        },
        objectTypes: {},
        functions: {
          "useImportedPackage": {
            ndcKind: FunctionNdcKind.Function,
            description: null,
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
      functionIssues: {
        "delete_todos": [
          "Unable to derive an NDC type for function 'delete_todos' return value (type: string | { error: string; }). Assuming that it is a scalar type."
        ],
        "insert_todos": [
          "Unable to derive an NDC type for function 'insert_todos' return value (type: {} | { id: string; user_id: string; todo: string; created_at: string; } | { message: string; } | { error: string; }). Assuming that it is a scalar type."
        ],
        "insert_user": [
          "Unable to derive an NDC type for function 'insert_user' return value (type: {} | { id: string; name: string; created_at: string; } | { message: string; } | { error: string; }). Assuming that it is a scalar type."
        ],
      },
      functionsSchema: {
        functions: {
          "insert_user": {
            ndcKind: FunctionNdcKind.Procedure,
            description: null,
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
              name: "insert_user_output"
            }
          },
          "insert_todos": {
            ndcKind: FunctionNdcKind.Procedure,
            description: null,
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
              name: "insert_todos_output"
            }
          },
          "delete_todos": {
            ndcKind: FunctionNdcKind.Procedure,
            description: null,
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
              kind: "scalar",
              name: "delete_todos_output"
            }
          },
        },
        scalarTypes: {
          String: {},
          insert_todos_output: {},
          insert_user_output: {},
          delete_todos_output: {},
        },
        objectTypes: {},
      }
    })
  });
});
