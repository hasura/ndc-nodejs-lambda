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
          "Class types are not supported, but one was encountered in function 'bar' parameter 'clazz' (type: MyClass)"
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

  it("never", function() {
    const schema = deriveSchema(require.resolve("./never.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {
        "neverFunction": [
          "The never type is not supported, but one was encountered in function 'neverFunction' parameter 'test'"
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

  it("object", function() {
    const schema = deriveSchema(require.resolve("./object.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {
        "objectFunction": [
          "The object type is not supported, but one was encountered in function 'objectFunction' parameter 'test'"
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

  it("unknown", function() {
    const schema = deriveSchema(require.resolve("./unknown.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {
        "unknownFunction": [
          "The unknown type is not supported, but one was encountered in function 'unknownFunction' parameter 'test'"
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

  it("any", function() {
    const schema = deriveSchema(require.resolve("./any.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {
        "anyFunction": [
          "The any type is not supported, but one was encountered in function 'anyFunction' parameter 'test'"
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

  it("tuple types", function() {
    const schema = deriveSchema(require.resolve("./tuple-types.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {
        "tuple1": [
          "Tuple types are not supported, but one was encountered in function 'tuple1' parameter 'test' (type: [string])"
        ],
        "tuple2": [
          "Tuple types are not supported, but one was encountered in function 'tuple2' parameter 'test' (type: [string, number])"
        ],
        "tupleAlias": [
          "Tuple types are not supported, but one was encountered in function 'tupleAlias' parameter 'test' (type: Tuple<number, boolean>)"
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

  it("function types", function() {
    const schema = deriveSchema(require.resolve("./function-types.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {
        "functionExpressionType": [
          "Function types are not supported, but one was encountered in function 'functionExpressionType' parameter 'test' (type: (i: number) => string)"
        ],
        "objectWithCallSignature": [
          "Function types are not supported, but one was encountered in function 'objectWithCallSignature' parameter 'test' (type: ObjectWithCallSignature)"
        ],
        "objectWithConstructSignature": [
          "Function types are not supported, but one was encountered in function 'objectWithConstructSignature' parameter 'test' (type: ObjectWithConstructSignature)"
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

  it("union types", function() {
    const schema = deriveSchema(require.resolve("./union-types.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {
        "unionTypes": [
          "Union types are not supported, but one was encountered in function 'unionTypes' parameter 'numberOrString' (type: string | number)",
          "Union types are not supported, but one was encountered in function 'unionTypes' parameter 'aliasedUnion' (type: AliasedUnion)",
          "Union types are not supported, but one was encountered in function 'unionTypes' parameter 'unionedObjects' (type: { prop1: string; } | { prop2: string; })"
        ],
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

  it("map types", function() {
    const schema = deriveSchema(require.resolve("./map-types.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {
        "mapType": [
          "Map types are not supported, but one was encountered in function 'mapType' parameter 'param' (type: Map<string, string>)",
        ],
        "recordType": [
          "Types with index signatures are not supported, but one was encountered in function 'recordType' parameter 'param' (type: Record<string, string>)",
        ],
        "objectWithIndexSignatureType": [
          "Types with index signatures are not supported, but one was encountered in function 'objectWithIndexSignatureType' parameter 'param' (type: ObjectWithIndexSignature)",
        ],
        "objectWithPropsAndIndexSignatureType": [
          "Types with index signatures are not supported, but one was encountered in function 'objectWithPropsAndIndexSignatureType' parameter 'param' (type: ObjectWithPropsAndIndexSignature)",
        ],
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
});
