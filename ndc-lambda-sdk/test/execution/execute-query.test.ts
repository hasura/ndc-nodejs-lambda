import { describe, it } from "mocha";
import { assert } from "chai";
import * as sdk from "@hasura/ndc-sdk-typescript"
import { executeQuery } from "../../src/execution";
import { FunctionNdcKind, FunctionsSchema } from "../../src/schema";

describe("execute query", function() {
  it("executes the function", async function() {
    let functionCallCount = 0;
    const runtimeFunctions = {
      "theFunction": (param: string) => {
        functionCallCount++;
        return `Called with '${param}'`;
      }
    };
    const functionSchema: FunctionsSchema = {
      functions: {
        "theFunction": {
          ndcKind: FunctionNdcKind.Function,
          description: null,
          arguments: [
            {
              argumentName: "param",
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
            name: "String"
          }
        }
      },
      objectTypes: {},
      scalarTypes: {
        "String": {}
      }
    };
    const queryRequest: sdk.QueryRequest = {
      collection: "theFunction",
      query: {
        fields: {},
      },
      arguments: {
        "param": {
          type: "literal",
          value: "test"
        }
      },
      collection_relationships: {}
    };

    const result = await executeQuery(queryRequest, functionSchema, runtimeFunctions);
    assert.deepStrictEqual(result, [
      {
        aggregates: {},
        rows: [
          { __value: "Called with 'test'" }
        ]
      }
    ]);
    assert.equal(functionCallCount, 1);
  });

  it("when there are variables, executes the function for each variable", async function() {
    let functionCallCount = 0;
    const runtimeFunctions = {
      "theFunction": (param: string, param2: string) => {
        functionCallCount++;
        return `Called with '${param}' and '${param2}'`;
      }
    };
    const functionSchema: FunctionsSchema = {
      functions: {
        "theFunction": {
          ndcKind: FunctionNdcKind.Function,
          description: null,
          arguments: [
            {
              argumentName: "param",
              description: null,
              type: {
                type: "named",
                kind: "scalar",
                name: "String"
              }
            },
            {
              argumentName: "param2",
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
            name: "String"
          }
        }
      },
      objectTypes: {},
      scalarTypes: {
        "String": {}
      }
    };
    const queryRequest: sdk.QueryRequest = {
      collection: "theFunction",
      query: {
        fields: {},
      },
      arguments: {
        "param": {
          type: "literal",
          value: "test"
        },
        "param2": {
          type: "variable",
          name: "var1"
        }
      },
      collection_relationships: {},
      variables: [
        {
          "var1": "first"
        },
        {
          "var1": "second"
        }
      ]
    };

    const result = await executeQuery(queryRequest, functionSchema, runtimeFunctions);
    assert.deepStrictEqual(result, [
      {
        aggregates: {},
        rows: [
          { __value: "Called with 'test' and 'first'" }
        ]
      },
      {
        aggregates: {},
        rows: [
          { __value: "Called with 'test' and 'second'" }
        ]
      }
    ]);
    assert.equal(functionCallCount, 2);
  })
});
