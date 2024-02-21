import { describe, it } from "mocha";
import { assert } from "chai";
import { deriveSchema } from "../../../src/inference";
import { BuiltInScalarTypeName, FunctionNdcKind, NullOrUndefinability } from "../../../src/schema";

describe("parallel degree", function() {
  it("reads the parallel degree from the JSDoc tag", function() {
    const schema = deriveSchema(require.resolve("./valid.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {},
      functionsSchema: {
        functions: {
          "withoutTag": {
            ndcKind: FunctionNdcKind.Function,
            description: null,
            parallelDegree: null,
            arguments: [],
            resultType: {
              name: "String",
              kind: "scalar",
              type: "named",
            }
          },
          "withTag": {
            ndcKind: FunctionNdcKind.Function,
            description: null,
            parallelDegree: 666,
            arguments: [],
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

  it("fails if the JSDoc tag is misused", function() {
    const schema = deriveSchema(require.resolve("./invalid.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {
        "tagUsedOnProcedure": [
          "The @paralleldegree JSDoc tag is only supported on functions also marked with the @readonly JSDoc tag"
        ],
        "invalidTagValue": [
          "The @paralleldegree JSDoc tag must specify an integer degree value that is greater than 0. Current value: 'garbage'"
        ],
        "zeroParallelDegreeValue": [
          "The @paralleldegree JSDoc tag must specify an integer degree value that is greater than 0. Current value: '0'"
        ],
        "negativeDegreeValue": [
          "The @paralleldegree JSDoc tag must specify an integer degree value that is greater than 0. Current value: '-1'"
        ]
      },
      functionsSchema: {
        functions: {},
        scalarTypes: {
          String: { type: "built-in" },
        },
        objectTypes: {},
      }
    })
  });
});
