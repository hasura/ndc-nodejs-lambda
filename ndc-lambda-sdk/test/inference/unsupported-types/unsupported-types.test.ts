import { describe, it } from "mocha";
import { assert } from "chai";
import { deriveSchema } from "../../../src/inference";

describe("unsupported types", function() {
  it("classes", function() {
    const schema = deriveSchema(require.resolve("./classes.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {
        "bar": [
          "Class types are not supported, but one was encountered in function 'bar' parameter 'clazz'"
        ]
      },
      functionsSchema: {
        scalarTypes: {
          String: {},
        },
        objectTypes: {},
        functions: {}
      }
    })
  });

  it("void", function() {
    const schema = deriveSchema(require.resolve("./void.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {
        "voidFunction": [
          "The void type is not supported, but one was encountered in function 'voidFunction' return value"
        ]
      },
      functionsSchema: {
        scalarTypes: {},
        objectTypes: {},
        functions: {}
      }
    })
  });

  it("promises", function() {
    const schema = deriveSchema(require.resolve("./promises.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {
        "promiseParam": [
          "Promise types are not supported, but one was encountered in function 'promiseParam' parameter 'input'."
        ],
        "nestedPromiseInParam": [
          "Promise types are not supported, but one was encountered in function 'nestedPromiseInParam' parameter 'x', type 'Bar' property 'str'."
        ],
        "nestedPromiseInRetval": [
          "Promise types are not supported, but one was encountered in function 'nestedPromiseInRetval' return value, type 'Bar' property 'str'."
        ]
      },
      functionsSchema: {
        scalarTypes: {
          String: {}
        },
        objectTypes: {},
        functions: {}
      }
    })
  });

  it("null or undefined literals", function() {
    const schema = deriveSchema(require.resolve("./null-undefined-literals.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {
        "literalTypes": [
          "The null type is not supported as a type literal used on its own, but one was encountered in function 'literalTypes' return value, type 'LiteralProps' property 'literalNull'",
          "The undefined type is not supported as a type literal used on its own, but one was encountered in function 'literalTypes' return value, type 'LiteralProps' property 'literalUndefined'"
        ]
      },
      functionsSchema: {
        scalarTypes: {},
        objectTypes: {},
        functions: {}
      }
    })
  });
});
