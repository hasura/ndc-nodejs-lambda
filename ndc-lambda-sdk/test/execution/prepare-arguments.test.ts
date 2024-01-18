import { describe, it } from "mocha";
import { assert } from "chai";
import { prepareArguments } from "../../src/execution";
import { BuiltInScalarTypeName, FunctionDefinition, FunctionNdcKind, JSONValue, NullOrUndefinability, ObjectTypeDefinitions } from "../../src/schema";
import { UnprocessableContent } from "@hasura/ndc-sdk-typescript";

describe("prepare arguments", function() {
  it("argument ordering", function() {
    const functionDefinition: FunctionDefinition = {
      ndcKind: FunctionNdcKind.Function,
      description: null,
      arguments: [
        {
          argumentName: "c",
          description: null,
          type: {
            type: "named",
            kind: "scalar",
            name: "Float"
          }
        },
        {
          argumentName: "a",
          description: null,
          type: {
            type: "named",
            kind: "scalar",
            name: "Float"
          }
        },
        {
          argumentName: "b",
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
      }
    }
    const objectTypes: ObjectTypeDefinitions = {}
    const args = {
      b: 1,
      a: 2,
      c: 3,
    }

    const preparedArgs = prepareArguments(args, functionDefinition, objectTypes);

    assert.deepStrictEqual(preparedArgs, [ 3, 2, 1 ]);
  });

  describe("nullable type coercion", function() {
    const functionDefinition: FunctionDefinition = {
      ndcKind: FunctionNdcKind.Function,
      description: null,
      arguments: [
        {
          argumentName: "nullOnlyArg",
          description: null,
          type: {
            type: "nullable",
            nullOrUndefinability: NullOrUndefinability.AcceptsNullOnly,
            underlyingType: {
              type: "named",
              kind: "scalar",
              name: "String"
            }
          }
        },
        {
          argumentName: "undefinedOnlyArg",
          description: null,
          type: {
            type: "nullable",
            nullOrUndefinability: NullOrUndefinability.AcceptsUndefinedOnly,
            underlyingType: {
              type: "named",
              kind: "scalar",
              name: "String"
            }
          }
        },
        {
          argumentName: "nullOrUndefinedArg",
          description: null,
          type: {
            type: "nullable",
            nullOrUndefinability: NullOrUndefinability.AcceptsEither,
            underlyingType: {
              type: "named",
              kind: "scalar",
              name: "String"
            }
          }
        },
        {
          argumentName: "objectArg",
          description: null,
          type: {
            type: "named",
            kind: "object",
            name: "MyObject",
          }
        },
        {
          argumentName: "nullOnlyArrayArg",
          description: null,
          type: {
            type: "array",
            elementType: {
              type: "nullable",
              nullOrUndefinability: NullOrUndefinability.AcceptsNullOnly,
              underlyingType: {
                type: "named",
                kind: "scalar",
                name: "String"
              }
            }
          }
        },
        {
          argumentName: "undefinedOnlyArrayArg",
          description: null,
          type: {
            type: "array",
            elementType: {
              type: "nullable",
              nullOrUndefinability: NullOrUndefinability.AcceptsUndefinedOnly,
              underlyingType: {
                type: "named",
                kind: "scalar",
                name: "String"
              }
            }
          }
        },
        {
          argumentName: "nullOrUndefinedArrayArg",
          description: null,
          type: {
            type: "array",
            elementType: {
              type: "nullable",
              nullOrUndefinability: NullOrUndefinability.AcceptsEither,
              underlyingType: {
                type: "named",
                kind: "scalar",
                name: "String"
              }
            }
          }
        },
      ],
      resultType: {
        type: "named",
        kind: "scalar",
        name: "String"
      }
    }
    const objectTypes: ObjectTypeDefinitions = {
      "MyObject": {
        properties: [
          {
            propertyName: "nullOnlyProp",
            type: {
              type: "nullable",
              nullOrUndefinability: NullOrUndefinability.AcceptsNullOnly,
              underlyingType: {
                type: "named",
                kind: "scalar",
                name: "String"
              }
            }
          },
          {
            propertyName: "undefinedOnlyProp",
            type: {
              type: "nullable",
              nullOrUndefinability: NullOrUndefinability.AcceptsUndefinedOnly,
              underlyingType: {
                type: "named",
                kind: "scalar",
                name: "String"
              }
            }
          },
          {
            propertyName: "nullOrUndefinedProp",
            type: {
              type: "nullable",
              nullOrUndefinability: NullOrUndefinability.AcceptsEither,
              underlyingType: {
                type: "named",
                kind: "scalar",
                name: "String"
              }
            }
          }
        ]
      }
    }
    const testCases = [
      {
        name: "all nulls",
        args: {
          nullOnlyArg: null,
          undefinedOnlyArg: null,
          nullOrUndefinedArg: null,
          objectArg: {
            nullOnlyProp: null,
            undefinedOnlyProp: null,
            nullOrUndefinedProp: null,
          },
          nullOnlyArrayArg: [null, null],
          undefinedOnlyArrayArg: [null, null],
          nullOrUndefinedArrayArg: [null, null],
        },
        expected: [
          null,
          undefined,
          null,
          { nullOnlyProp: null, undefinedOnlyProp: undefined, nullOrUndefinedProp: null },
          [null, null],
          [undefined, undefined],
          [null, null],
        ]
      },
      {
        name: "all undefineds",
        args: {
          nullOnlyArg: undefined,
          undefinedOnlyArg: undefined,
          nullOrUndefinedArg: undefined,
          objectArg: {
            nullOnlyProp: undefined,
            undefinedOnlyProp: undefined,
            nullOrUndefinedProp: undefined,
          },
          nullOnlyArrayArg: [undefined, undefined],
          undefinedOnlyArrayArg: [undefined, undefined],
          nullOrUndefinedArrayArg: [undefined, undefined],
        },
        expected: [
          null,
          undefined,
          undefined,
          { nullOnlyProp: null, undefinedOnlyProp: undefined, nullOrUndefinedProp: undefined },
          [null, null],
          [undefined, undefined],
          [undefined, undefined],
        ]
      },
      {
        name: "all missing",
        args: {
          objectArg: {},
          nullOnlyArrayArg: [],
          undefinedOnlyArrayArg: [],
          nullOrUndefinedArrayArg: [],
        },
        expected: [
          null,
          undefined,
          undefined,
          { nullOnlyProp: null, undefinedOnlyProp: undefined, nullOrUndefinedProp: undefined },
          [],
          [],
          [],
        ]
      },
      {
        name: "all valued",
        args: {
          nullOnlyArg: "a",
          undefinedOnlyArg: "b",
          nullOrUndefinedArg: "c",
          objectArg: {
            nullOnlyProp: "d",
            undefinedOnlyProp: "e",
            nullOrUndefinedProp: "f",
          },
          nullOnlyArrayArg: ["g", "h"],
          undefinedOnlyArrayArg: ["i", "j"],
          nullOrUndefinedArrayArg: ["k", "l"],
        },
        expected: [
          "a",
          "b",
          "c",
          { nullOnlyProp: "d", undefinedOnlyProp: "e", nullOrUndefinedProp: "f" },
          ["g", "h"],
          ["i", "j"],
          ["k", "l"],
        ]
      },
    ];

    for (const testCase of testCases) {
      it(testCase.name, function() {
        const preparedArgs = prepareArguments(testCase.args, functionDefinition, objectTypes);
        assert.deepStrictEqual(preparedArgs, testCase.expected);
      });
    }
  });

  it("scalar type coercion", function() {
    const functionDefinition: FunctionDefinition = {
      ndcKind: FunctionNdcKind.Function,
      description: null,
      arguments: [
        {
          argumentName: "stringArg",
          description: null,
          type: {
            type: "named",
            kind: "scalar",
            name: "String"
          }
        },
        {
          argumentName: "boolArg",
          description: null,
          type: {
            type: "named",
            kind: "scalar",
            name: "Boolean"
          }
        },
        {
          argumentName: "floatArg",
          description: null,
          type: {
            type: "named",
            kind: "scalar",
            name: "Float"
          }
        },
        {
          argumentName: "bigIntArg",
          description: null,
          type: {
            type: "named",
            kind: "scalar",
            name: "BigInt"
          }
        },
        {
          argumentName: "dateTimeArg",
          description: null,
          type: {
            type: "named",
            kind: "scalar",
            name: "DateTime"
          }
        },
        {
          argumentName: "jsonArg",
          description: null,
          type: {
            type: "named",
            kind: "scalar",
            name: "JSON"
          }
        },
      ],
      resultType: {
        type: "named",
        kind: "scalar",
        name: "String"
      }
    }

    const args = {
      stringArg: "test",
      boolArg: true,
      floatArg: 123.456,
      bigIntArg: "1234",
      dateTimeArg: "2024-01-11T15:17:56Z",
      jsonArg: { some: "arbitrary", json: 123 }
    }

    const preparedArgs = prepareArguments(args, functionDefinition, {});
    const unwrappedArgs = preparedArgs.map(unwrapJSONValues); // We unwrap JSON values so equals works correctly
    assert.deepStrictEqual(unwrappedArgs, ["test", true, 123.456, BigInt(1234), new Date("2024-01-11T15:17:56Z"), { some: "arbitrary", json: 123 }]);
    assert.instanceOf(preparedArgs[5], JSONValue);
  });

  describe("validation of non-JSON scalar types", function() {
    const functionDefinition: FunctionDefinition = {
      ndcKind: FunctionNdcKind.Function,
      description: null,
      arguments: [
        {
          argumentName: "dateTime",
          description: null,
          type: {
            type: "named",
            kind: "scalar",
            name: BuiltInScalarTypeName.DateTime,
          }
        },
        {
          argumentName: "bigInt",
          description: null,
          type: {
            type: "named",
            kind: "scalar",
            name: BuiltInScalarTypeName.BigInt,
          }
        },
      ],
      resultType: {
        type: "named",
        kind: "scalar",
        name: "String"
      }
    }
    const objectTypes: ObjectTypeDefinitions = {}

    describe("fails validation", function() {
      const correctArgs = {
        dateTime: "2024-01-11T15:17:56Z",
        bigInt: 678n,
      };

      it("DateTime (invalid format)", function() {
        const args = { ...correctArgs, dateTime: "NotADateTime" };
        assert.throws(() => prepareArguments(args, functionDefinition, objectTypes), UnprocessableContent, "Invalid value in function arguments. Expected an ISO 8601 calendar date extended format string at 'dateTime', but the value failed to parse: 'NotADateTime'")
      });
      it("BigInt (floating point number)", function() {
        const args = { ...correctArgs, bigInt: 123.123 };
        assert.throws(() => prepareArguments(args, functionDefinition, objectTypes), UnprocessableContent, "Invalid value in function arguments. Expected a integer number at 'bigInt', got a float: '123.123'")
      });
      it("BigInt (non-integer string)", function() {
        const args = { ...correctArgs, bigInt: "123a" };
        assert.throws(() => prepareArguments(args, functionDefinition, objectTypes), UnprocessableContent, "Invalid value in function arguments. Expected a bigint string at 'bigInt', got a non-integer string: '123a'")
      });
    });
  });

  describe("validation of literal types", function() {
    const functionDefinition: FunctionDefinition = {
      ndcKind: FunctionNdcKind.Function,
      description: null,
      arguments: [
        {
          argumentName: "literalString",
          description: null,
          type: {
            type: "named",
            kind: "scalar",
            name: BuiltInScalarTypeName.String,
            literalValue: "literal-string"
          }
        },
        {
          argumentName: "literalFloat",
          description: null,
          type: {
            type: "named",
            kind: "scalar",
            name: BuiltInScalarTypeName.Float,
            literalValue: 123.567
          }
        },
        {
          argumentName: "literalBool",
          description: null,
          type: {
            type: "named",
            kind: "scalar",
            name: BuiltInScalarTypeName.Boolean,
            literalValue: true
          }
        },
        {
          argumentName: "literalBigInt",
          description: null,
          type: {
            type: "named",
            kind: "scalar",
            name: BuiltInScalarTypeName.BigInt,
            literalValue: 678n
          }
        },
      ],
      resultType: {
        type: "named",
        kind: "scalar",
        name: "String"
      }
    }
    const objectTypes: ObjectTypeDefinitions = {}

    it("passes validation", function() {
      const args = {
        literalString: "literal-string",
        literalFloat: 123.567,
        literalBool: true,
        literalBigInt: 678n,
      }

      const preparedArgs = prepareArguments(args, functionDefinition, objectTypes);

      assert.deepStrictEqual(preparedArgs, [ "literal-string", 123.567, true, 678n ]);
    });

    describe("fails validation", function() {
      const correctArgs = {
        literalString: "literal-string",
        literalFloat: 123.567,
        literalBool: true,
        literalBigInt: 678n,
      };

      it("String", function() {
        const args = { ...correctArgs, literalString: "something else" };
        assert.throws(() => prepareArguments(args, functionDefinition, objectTypes), UnprocessableContent, "Invalid value in function arguments. Only the value 'literal-string' is accepted at 'literalString', got 'something else'")
      });
      it("Float", function() {
        const args = { ...correctArgs, literalFloat: 10 };
        assert.throws(() => prepareArguments(args, functionDefinition, objectTypes), UnprocessableContent, "Invalid value in function arguments. Only the value '123.567' is accepted at 'literalFloat', got '10'")
      });
      it("Boolean", function() {
        const args = { ...correctArgs, literalBool: false };
        assert.throws(() => prepareArguments(args, functionDefinition, objectTypes), UnprocessableContent, "Invalid value in function arguments. Only the value 'true' is accepted at 'literalBool', got 'false'")
      });
      it("BigInt", function() {
        const args = { ...correctArgs, literalBigInt: 789n };
        assert.throws(() => prepareArguments(args, functionDefinition, objectTypes), UnprocessableContent, "Invalid value in function arguments. Only the value '678' is accepted at 'literalBigInt', got '789'")
      });
    });
  });
});

function unwrapJSONValues(x: unknown): unknown {
  return x instanceof JSONValue
    ? x.value
    : x;
}
