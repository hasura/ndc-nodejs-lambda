import { describe, it } from "mocha";
import { assert, expect } from "chai";
import * as sdk from "@hasura/ndc-sdk-typescript"
import { executeMutation } from "../../src/execution";
import { FunctionNdcKind, FunctionsSchema } from "../../src/schema";

describe("execute mutation", function() {
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
          ndcKind: FunctionNdcKind.Procedure,
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
        "String": { type: "built-in" },
      }
    };
    const mutationRequest: sdk.MutationRequest = {
      operations: [
        {
          type: "procedure",
          name: "theFunction",
          fields: null,
          arguments: {
            "param": "test"
          }
        }
      ],
      collection_relationships: {}
    };

    const result = await executeMutation(mutationRequest, functionSchema, runtimeFunctions);
    assert.deepStrictEqual(result, {
      operation_results: [
        {
          type: "procedure",
          result: "Called with 'test'"
        }
      ]
    });
    assert.equal(functionCallCount, 1);
  });

  it("can select into the result using nested fields", async function() {
    let functionCallCount = 0;
    const runtimeFunctions = {
      "theFunction": (param: string) => {
        functionCallCount++;
        return {
          calledWithStr: `Called with '${param}'`,
          param,
          functionCallCount,
        };
      }
    };
    const functionSchema: FunctionsSchema = {
      functions: {
        "theFunction": {
          ndcKind: FunctionNdcKind.Procedure,
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
            kind: "object",
            name: "FunctionResult"
          }
        }
      },
      objectTypes: {
        "FunctionResult": {
          description: null,
          properties: [
            {
              propertyName: "calledWithStr",
              description: null,
              type: {
                type: "named",
                kind: "scalar",
                name: "String"
              }
            },
            {
              propertyName: "param",
              description: null,
              type: {
                type: "named",
                kind: "scalar",
                name: "String"
              }
            },
            {
              propertyName: "functionCallCount",
              description: null,
              type: {
                type: "named",
                kind: "scalar",
                name: "Float"
              }
            }
          ],
          isRelaxedType: false,
        }
      },
      scalarTypes: {
        "Float": { type: "built-in" },
        "String": { type: "built-in" },
      }
    };
    const mutationRequest: sdk.MutationRequest = {
      operations: [
        {
          type: "procedure",
          name: "theFunction",
          fields: {
            type: "object",
            fields: {
              "str": {
                type: "column",
                column: "calledWithStr",
              },
              "callCount": {
                type: "column",
                column: "functionCallCount"
              }
            }
          },
          arguments: {
            "param": "test"
          }
        }
      ],
      collection_relationships: {}
    };

    const result = await executeMutation(mutationRequest, functionSchema, runtimeFunctions);
    assert.deepStrictEqual(result, {
      operation_results: [
        {
          type: "procedure",
          result: {
            str: "Called with 'test'",
            callCount: 1
          }
        }
      ]
    });
    assert.equal(functionCallCount, 1);
  });

  it("blocks execution of multiple operations", async function() {
    let functionCallCount = 0;
    const runtimeFunctions = {
      "theFunction": (param: string) => {
        functionCallCount++;
        return `First function called with '${param}'`;
      }
    };
    const functionSchema: FunctionsSchema = {
      functions: {
        "theFunction": {
          ndcKind: FunctionNdcKind.Procedure,
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
        "String": { type: "built-in" },
      }
    };
    const mutationRequest: sdk.MutationRequest = {
      operations: [
        {
          type: "procedure",
          name: "theFunction",
          fields: null,
          arguments: {
            "param": "test"
          }
        },
        {
          type: "procedure",
          name: "theFunction",
          fields: null,
          arguments: {
            "param": "test2"
          }
        }
      ],
      collection_relationships: {}
    };

    await expect(executeMutation(mutationRequest, functionSchema, runtimeFunctions))
        .to.be.rejectedWith(sdk.NotSupported, "Transactional mutations (multiple operations) are not supported");
    assert.equal(functionCallCount, 0);
  });

  describe("function error handling", function() {
    const functionSchema: FunctionsSchema = {
      functions: {
        "theFunction": {
          ndcKind: FunctionNdcKind.Procedure,
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
        "String": { type: "built-in" },
      }
    };
    const mutationRequest: sdk.MutationRequest = {
      operations: [{
        type: "procedure",
        name: "theFunction",
        arguments: {},
        fields: null,
      }],
      collection_relationships: {}
    };

    it("Error -> sdk.InternalServerError", async function() {
      const runtimeFunctions = {
        "theFunction": () => {
          throw new Error("BOOM!");
        }
      };

      await expect(executeMutation(mutationRequest, functionSchema, runtimeFunctions))
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

      await expect(executeMutation(mutationRequest, functionSchema, runtimeFunctions))
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

      await expect(executeMutation(mutationRequest, functionSchema, runtimeFunctions))
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

          await expect(executeMutation(mutationRequest, functionSchema, runtimeFunctions))
            .to.be.rejectedWith(exceptionCtor, "Nope!")
            .and.eventually.property("details").deep.equals({"deets": "stuff"});
        });
      }
    });
  })

});
