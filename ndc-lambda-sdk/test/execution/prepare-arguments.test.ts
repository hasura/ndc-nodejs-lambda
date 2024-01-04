import { describe, it } from "mocha";
import { assert } from "chai";
import { prepareArguments } from "../../src/execution";
import { FunctionDefinition, FunctionNdcKind, NullOrUndefinability, ObjectTypeDefinitions } from "../../src/schema";

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
        const prepared_args = prepareArguments(testCase.args, functionDefinition, objectTypes);
        assert.deepStrictEqual(prepared_args, testCase.expected);
      });
    }
  });
});
