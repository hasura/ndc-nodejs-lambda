import { describe, it } from "mocha";
import { assert } from "chai";
import { deriveSchema } from "../../../src/inference";
import { FunctionNdcKind } from "../../../src/schema";

describe("naming conflicts", function() {
  it("conflict from import", function() {
    const schema = deriveSchema(require.resolve("./conflict-from-import.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {},
      functionsSchema: {
        functions: {
          "foo": {
            ndcKind: FunctionNdcKind.Procedure,
            description: null,
            parallelDegree: null,
            arguments: [],
            resultType: {
              name: "Foo",
              kind: "object",
              type: "named",
            },
          }
        },
        objectTypes: {
          Foo: {
            properties: [
              {
                propertyName: "x",
                type: {
                  name: "Boolean",
                  kind: "scalar",
                  type: "named",
                },
              },
              {
                propertyName: "y",
                type: {
                  name: "conflict_from_import_dep_Foo",
                  kind: "object",
                  type: "named",
                },
              },
            ]
          },
          conflict_from_import_dep_Foo: {
            properties: [
              {
                propertyName: "a",
                type: {
                  name: "String",
                  kind: "scalar",
                  type: "named",
                },
              },
              {
                propertyName: "b",
                type: {
                  name: "Float",
                  kind: "scalar",
                  type: "named",
                },
              },
            ]
          },
        },
        scalarTypes: {
          Boolean: {},
          Float: {},
          String: {},
        }
      }
    })
  });
});
