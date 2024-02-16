import { describe, it } from "mocha";
import { assert } from "chai";
import { deriveSchema } from "../../../src/inference";
import { BuiltInScalarTypeName, FunctionNdcKind, NullOrUndefinability } from "../../../src/schema";

describe("re-exported functions", function() {
  it("supports functions re-exported from other files", function() {
    const schema = deriveSchema(require.resolve("./functions.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {},
      functionsSchema: {
        functions: {
          "rootFileFunction": {
            ndcKind: FunctionNdcKind.Function,
            description: null,
            parallelDegree: null,
            arguments: [
              {
                argumentName: "input",
                description: null,
                type: {
                  name: "String",
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
          },
          "fileAChildFunction": {
            ndcKind: FunctionNdcKind.Procedure,
            description: null,
            parallelDegree: null,
            arguments: [],
            resultType: {
              name: "String",
              kind: "scalar",
              type: "named",
            }
          },
          "fileBChildFunction1": {
            ndcKind: FunctionNdcKind.Procedure,
            description: null,
            parallelDegree: null,
            arguments: [],
            resultType: {
              name: "Boolean",
              kind: "scalar",
              type: "named",
            }
          },
          "fileBChildFunction2": {
            ndcKind: FunctionNdcKind.Function,
            description: null,
            parallelDegree: null,
            arguments: [
              {
                argumentName: "input",
                description: null,
                type: {
                  name: "String",
                  kind: "scalar",
                  type: "named",
                }
              }
            ],
            resultType: {
              name: "String",
              kind: "scalar",
              type: "named",
            }
          },
        },
        scalarTypes: {
          Boolean: { type: "built-in" },
          Float: { type: "built-in" },
          String: { type: "built-in" },
        },
        objectTypes: {},
      }
    })
  });

  it("supports a filtered re-export of functions from other files", function() {
    const schema = deriveSchema(require.resolve("./functions-subset.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {},
      functionsSchema: {
        functions: {
          "rootFileFunction": {
            ndcKind: FunctionNdcKind.Function,
            description: null,
            parallelDegree: null,
            arguments: [
              {
                argumentName: "input",
                description: null,
                type: {
                  name: "String",
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
          },
          "fileAChildFunction": {
            ndcKind: FunctionNdcKind.Procedure,
            description: null,
            parallelDegree: null,
            arguments: [],
            resultType: {
              name: "String",
              kind: "scalar",
              type: "named",
            }
          },
          "fileBChildFunction2": {
            ndcKind: FunctionNdcKind.Function,
            description: null,
            parallelDegree: null,
            arguments: [
              {
                argumentName: "input",
                description: null,
                type: {
                  name: "String",
                  kind: "scalar",
                  type: "named",
                }
              }
            ],
            resultType: {
              name: "String",
              kind: "scalar",
              type: "named",
            }
          },
        },
        scalarTypes: {
          Float: { type: "built-in" },
          String: { type: "built-in" },
        },
        objectTypes: {},
      }
    })
  });

  it("supports renamed re-exports of functions from other files", function() {
    const schema = deriveSchema(require.resolve("./functions-renamed.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {},
      functionsSchema: {
        functions: {
          "renamedFileAChildFunction": {
            ndcKind: FunctionNdcKind.Procedure,
            description: null,
            parallelDegree: null,
            arguments: [],
            resultType: {
              name: "String",
              kind: "scalar",
              type: "named",
            }
          },
          "renamedFileBChildFunction2": {
            ndcKind: FunctionNdcKind.Function,
            description: null,
            parallelDegree: null,
            arguments: [
              {
                argumentName: "input",
                description: null,
                type: {
                  name: "String",
                  kind: "scalar",
                  type: "named",
                }
              }
            ],
            resultType: {
              name: "String",
              kind: "scalar",
              type: "named",
            }
          },
        },
        scalarTypes: {
          String: { type: "built-in" },
        },
        objectTypes: {},
      }
    })
  });
});
