import { describe, it } from "mocha";
import { assert, expect } from "chai";
import * as sdk from "@hasura/ndc-sdk-typescript"
import { executeQuery } from "../../src/execution";
import { FunctionNdcKind, FunctionsSchema } from "../../src/schema";
import { sleep } from "../../src/util";

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
          parallelDegree: null,
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
        "String": { type: "built-in" }
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
          parallelDegree: null,
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
        "String": { type: "built-in" }
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
  });

  it("when there are variables, executes the function in parallel, but respecting the configured parallel degree", async function() {
    let functionCallCompletions: string[] = [];
    const runtimeFunctions = {
      "theFunction": async (invocationName: string, sleepMs: number) => {
        await sleep(sleepMs);
        functionCallCompletions.push(invocationName)
        return invocationName;
      }
    };
    const functionSchema: FunctionsSchema = {
      functions: {
        "theFunction": {
          ndcKind: FunctionNdcKind.Function,
          description: null,
          parallelDegree: 3,
          arguments: [
            {
              argumentName: "invocationName",
              description: null,
              type: {
                type: "named",
                kind: "scalar",
                name: "String"
              }
            },
            {
              argumentName: "sleepMs",
              description: null,
              type: {
                type: "named",
                kind: "scalar",
                name: "Float"
              }
            },
          ],
          resultType: {
            type: "named",
            kind: "scalar",
            name: "String"
          },
        }
      },
      objectTypes: {},
      scalarTypes: {
        "String": { type: "built-in" }
      }
    };
    const queryRequest: sdk.QueryRequest = {
      collection: "theFunction",
      query: {
        fields: {},
      },
      arguments: {
        "invocationName": {
          type: "variable",
          name: "invocationName"
        },
        "sleepMs": {
          type: "variable",
          name: "sleepMs"
        }
      },
      collection_relationships: {},
      variables: [
        {
          "invocationName": "first",
          "sleepMs": 100,
        },
        {
          "invocationName": "second",
          "sleepMs": 250,
        },
        {
          "invocationName": "third",
          "sleepMs": 150,
        },
        {
          "invocationName": "fourth",
          "sleepMs": 100,
        },
      ]
    };

    const result = await executeQuery(queryRequest, functionSchema, runtimeFunctions);
    assert.deepStrictEqual(result, [
      {
        aggregates: {},
        rows: [
          { __value: "first" }
        ]
      },
      {
        aggregates: {},
        rows: [
          { __value: "second" }
        ]
      },
      {
        aggregates: {},
        rows: [
          { __value: "third" }
        ]
      },
      {
        aggregates: {},
        rows: [
          { __value: "fourth" }
        ]
      },
    ]);
    assert.deepStrictEqual(functionCallCompletions, ["first", "third", "fourth", "second"]);
  });

  describe("function error handling", function() {
    const functionSchema: FunctionsSchema = {
      functions: {
        "theFunction": {
          ndcKind: FunctionNdcKind.Function,
          description: null,
          parallelDegree: null,
          arguments: [],
          resultType: {
            type: "named",
            kind: "scalar",
            name: "String"
          }
        }
      },
      objectTypes: {},
      scalarTypes: {
        "String": { type: "built-in" }
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

    it("Error -> sdk.InternalServerError", async function() {
      const runtimeFunctions = {
        "theFunction": () => {
          throw new Error("BOOM!");
        }
      };

      await expect(executeQuery(queryRequest, functionSchema, runtimeFunctions))
        .to.be.rejectedWith(sdk.InternalServerError, "Error encountered when invoking function 'theFunction'")
        .which.eventually.has.property("details")
        .which.include.keys("stack")
        .and.has.property("message", "BOOM!");
    });

    it("string -> sdk.InternalServerError", async function() {
      const runtimeFunctions = {
        "theFunction": () => {
          throw "A bad way to throw errors";
        }
      };

      await expect(executeQuery(queryRequest, functionSchema, runtimeFunctions))
        .to.be.rejectedWith(sdk.InternalServerError, "Error encountered when invoking function 'theFunction'")
        .which.eventually.has.property("details")
        .and.has.property("message", "A bad way to throw errors");
    });

    it("unknown -> sdk.InternalServerError", async function() {
      const runtimeFunctions = {
        "theFunction": () => {
          throw 666; // What are you even doing? 👊
        }
      };

      await expect(executeQuery(queryRequest, functionSchema, runtimeFunctions))
        .to.be.rejectedWith(sdk.InternalServerError, "Error encountered when invoking function 'theFunction'");
    });

    describe("sdk exceptions are passed through", function() {
      const exceptions = [
        sdk.BadRequest, sdk.Forbidden, sdk.Conflict, sdk.UnprocessableContent, sdk.InternalServerError, sdk.NotSupported, sdk.BadGateway
      ];

      for (const exceptionCtor of exceptions) {
        it(`sdk.${exceptionCtor.name}`, async function() {
          const runtimeFunctions = {
            "theFunction": () => {
              throw new exceptionCtor("Nope!", { deets: "stuff" });
            }
          };

          await expect(executeQuery(queryRequest, functionSchema, runtimeFunctions))
            .to.be.rejectedWith(exceptionCtor, "Nope!")
            .and.eventually.property("details").deep.equals({"deets": "stuff"});
        });
      }
    });
  })
});
