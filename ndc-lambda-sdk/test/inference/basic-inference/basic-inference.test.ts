import { describe, it } from "mocha";
import { assert } from "chai";
import { deriveSchema } from "../../../src/inference";
import { BuiltInScalarTypeName, FunctionNdcKind, NullOrUndefinability } from "../../../src/schema";

describe("basic inference", function() {
  it("simple types", function() {
    const schema = deriveSchema(require.resolve("./simple-types.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {},
      functionsSchema: {
        scalarTypes: {
          BigInt: {},
          Boolean: {},
          Float: {},
          String: {},
          DateTime: {},
          JSON: {},
        },
        objectTypes: {},
        functions: {
          "hello": {
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
          "add": {
            ndcKind: FunctionNdcKind.Function,
            description: null,
            parallelDegree: null,
            arguments: [
              {
                argumentName: "a",
                description: null,
                type: {
                  name: "Float",
                  kind: "scalar",
                  type: "named",
                }
              },
              {
                argumentName: "b",
                description: null,
                type: {
                  name: "Float",
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
          "isEven": {
            ndcKind: FunctionNdcKind.Function,
            description: null,
            parallelDegree: null,
            arguments: [
              {
                argumentName: "x",
                description: null,
                type: {
                  name: "BigInt",
                  kind: "scalar",
                  type: "named",
                }
              }
            ],
            resultType: {
              name: "Boolean",
              kind: "scalar",
              type: "named",
            }
          },
          "dateTime": {
            ndcKind: FunctionNdcKind.Procedure,
            description: null,
            parallelDegree: null,
            arguments: [],
            resultType: {
              name: "DateTime",
              kind: "scalar",
              type: "named",
            }
          },
          "json": {
            ndcKind: FunctionNdcKind.Function,
            description: null,
            parallelDegree: null,
            arguments: [
              {
                argumentName: "input",
                description: null,
                type: {
                  name: "JSON",
                  kind: "scalar",
                  type: "named",
                }
              }
            ],
            resultType: {
              name: "JSON",
              kind: "scalar",
              type: "named",
            }
          }
        }
      }
    })
  });

  it("object return type", function() {
    const schema = deriveSchema(require.resolve("./object-return-type.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {},
      functionsSchema: {
        functions: {
          "complex": {
            ndcKind: FunctionNdcKind.Procedure,
            description: null,
            parallelDegree: null,
            arguments: [
              {
                argumentName: "a",
                description: null,
                type: {
                  name: "Float",
                  kind: "scalar",
                  type: "named",
                }
              },
              {
                argumentName: "b",
                description: null,
                type: {
                  name: "Float",
                  kind: "scalar",
                  type: "named",
                }
              },
              {
                argumentName: "c",
                description: null,
                type: {
                  type: "nullable",
                  nullOrUndefinability: NullOrUndefinability.AcceptsUndefinedOnly,
                  underlyingType: {
                    name: "String",
                    kind: "scalar",
                    type: "named",
                  }
                }
              }
            ],
            resultType: {
              name: "Result",
              kind: "object",
              type: "named",
            },
          }
        },
        objectTypes: {
          Result: {
            properties: [
              {
                propertyName: "num",
                type: {
                  name: "Float",
                  kind: "scalar",
                  type: "named",
                },
              },
              {
                propertyName: "str",
                type: {
                  name: "String",
                  kind: "scalar",
                  type: "named",
                },
              },
              {
                propertyName: "bod",
                type: {
                  name: "String",
                  kind: "scalar",
                  type: "named",
                },
              },
            ]
          },
        },
        scalarTypes: {
          Float: {},
          String: {},
        }
      }
    })
  })

  it("complex types", function() {
    const schema = deriveSchema(require.resolve("./complex-types.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {},
      functionsSchema: {
        functions: {
          "bar": {
            ndcKind: FunctionNdcKind.Procedure,
            description: null,
            parallelDegree: null,
            arguments: [
              {
                argumentName: "string",
                description: null,
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "String"
                }
              },
              {
                argumentName: "aliasedString",
                description: null,
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "String"
                }
              },
              {
                argumentName: "genericScalar",
                description: null,
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "String"
                }
              },
              {
                argumentName: "array",
                description: null,
                type: {
                  type: "array",
                  elementType: {
                    type: "named",
                    kind: "scalar",
                    name: "String"
                  }
                }
              },
              {
                argumentName: "anonObj",
                description: null,
                type: {
                  type: "named",
                  kind: "object",
                  name: "bar_arguments_anonObj"
                }
              },
              {
                argumentName: "aliasedObj",
                description: null,
                type: {
                  type: "named",
                  kind: "object",
                  name: "Bar"
                }
              },
              {
                argumentName: "genericAliasedObj",
                description: null,
                type: {
                  type: "named",
                  kind: "object",
                  name: "GenericBar<string>"
                }
              },
              {
                argumentName: "genericAliasedObjWithComplexTypeParam",
                description: null,
                type: {
                  kind: "object",
                  name: "GenericBar<Bar>",
                  type: "named",
                }
              },
              {
                argumentName: "interfce",
                description: null,
                type: {
                  type: "named",
                  kind: "object",
                  name: "IThing"
                }
              },
              {
                argumentName: "genericInterface",
                description: null,
                type: {
                  type: "named",
                  kind: "object",
                  name: "IGenericThing"
                }
              },
              {
                argumentName: "aliasedIntersectionObj",
                description: null,
                type: {
                  type: "named",
                  kind: "object",
                  name: "IntersectionObject"
                }
              },
              {
                argumentName: "anonIntersectionObj",
                description: null,
                type: {
                  type: "named",
                  kind: "object",
                  name: "bar_arguments_anonIntersectionObj"
                }
              },
              {
                argumentName: "genericIntersectionObj",
                description: null,
                type: {
                  type: "named",
                  kind: "object",
                  name: "GenericIntersectionObject<string>"
                }
              },
            ],
            resultType: {
              name: "String",
              kind: "scalar",
              type: "named",
            }
          }
        },
        objectTypes: {
          "GenericBar<Bar>": {
            properties: [
              {
                propertyName: "data",
                type: {
                  kind: "object",
                  name: "Bar",
                  type: "named",
                },
              },
            ]
          },
          "GenericBar<string>": {
            properties: [
              {
                propertyName: "data",
                type: {
                  name: "String",
                  kind: "scalar",
                  type: "named",
                },
              },
            ],
          },
          "GenericIntersectionObject<string>": {
            properties: [
              {
                propertyName: "data",
                type: {
                  name: "String",
                  kind: "scalar",
                  type: "named",
                },
              },
              {
                propertyName: "test",
                type: {
                  name: "String",
                  kind: "scalar",
                  type: "named",
                },
              },
            ],
          },
          Bar: {
            properties: [
              {
                propertyName: "test",
                type: {
                  name: "String",
                  kind: "scalar",
                  type: "named",
                },
              },
            ],
          },
          IGenericThing: {
            properties: [
              {
                propertyName: "data",
                type: {
                  name: "String",
                  kind: "scalar",
                  type: "named",
                },
              },
            ],
          },
          IThing: {
            properties: [
              {
                propertyName: "prop",
                type: {
                  name: "String",
                  kind: "scalar",
                  type: "named",
                },
              },
            ],
          },
          IntersectionObject: {
            properties: [
              {
                propertyName: "wow",
                type: {
                  name: "String",
                  kind: "scalar",
                  type: "named",
                },
              },
              {
                propertyName: "test",
                type: {
                  name: "String",
                  kind: "scalar",
                  type: "named",
                },
              },
            ],
          },
          bar_arguments_anonIntersectionObj: {
            properties: [
              {
                propertyName: "num",
                type: {
                  name: "Float",
                  kind: "scalar",
                  type: "named",
                },
              },
              {
                propertyName: "test",
                type: {
                  name: "String",
                  kind: "scalar",
                  type: "named",
                },
              },
            ],
          },
          bar_arguments_anonObj: {
            properties: [
              {
                propertyName: "a",
                type: {
                  name: "Float",
                  kind: "scalar",
                  type: "named",
                },
              },
              {
                propertyName: "b",
                type: {
                  name: "String",
                  kind: "scalar",
                  type: "named",
                },
              },
            ],
          },
        },
        scalarTypes: {
          Float: {},
          String: {},
        }
      }
    })
  });

  it("nullable and undefined types", function() {
    const schema = deriveSchema(require.resolve("./nullable-types.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {},
      functionsSchema: {
        functions: {
          "test": {
            ndcKind: FunctionNdcKind.Procedure,
            description: null,
            parallelDegree: null,
            arguments: [
              {
                argumentName: "myObject",
                description: null,
                type: {
                  kind: "object",
                  name: "MyObject",
                  type: "named",
                },
              },
              {
                argumentName: "nullableParam",
                description: null,
                type: {
                  type: "nullable",
                  nullOrUndefinability: NullOrUndefinability.AcceptsNullOnly,
                  underlyingType: {
                    kind: "scalar",
                    name: "String",
                    type: "named",
                  },
                },
              },
              {
                argumentName: "undefinedParam",
                description: null,
                type: {
                  type: "nullable",
                  nullOrUndefinability: NullOrUndefinability.AcceptsUndefinedOnly,
                  underlyingType: {
                    kind: "scalar",
                    name: "String",
                    type: "named",
                  },
                },
              },
              {
                argumentName: "nullOrUndefinedParam",
                description: null,
                type: {
                  type: "nullable",
                  nullOrUndefinability: NullOrUndefinability.AcceptsEither,
                  underlyingType: {
                    kind: "scalar",
                    name: "String",
                    type: "named",
                  },
                },
              },
              {
                argumentName: "optionalParam",
                description: null,
                type: {
                  type: "nullable",
                  nullOrUndefinability: NullOrUndefinability.AcceptsUndefinedOnly,
                  underlyingType: {
                    kind: "scalar",
                    name: "String",
                    type: "named",
                  },
                },
              },
            ],
            resultType: {
              type: "nullable",
              nullOrUndefinability: NullOrUndefinability.AcceptsNullOnly,
              underlyingType: {
                kind: "scalar",
                name: "String",
                type: "named",
              }
            },
          },
        },
        objectTypes: {
          "MyObject": {
            properties: [
              {
                propertyName: "string",
                type: {
                  kind: "scalar",
                  name: "String",
                  type: "named",
                },
              },
              {
                propertyName: "nullableString",
                type: {
                  type: "nullable",
                  nullOrUndefinability: NullOrUndefinability.AcceptsNullOnly,
                  underlyingType: {
                    kind: "scalar",
                    name: "String",
                    type: "named",
                  },
                },
              },
              {
                propertyName: "optionalString",
                type: {
                  type: "nullable",
                  nullOrUndefinability: NullOrUndefinability.AcceptsUndefinedOnly,
                  underlyingType: {
                    kind: "scalar",
                    name: "String",
                    type: "named",
                  },
                },
              },
              {
                propertyName: "undefinedString",
                type: {
                  type: "nullable",
                  nullOrUndefinability: NullOrUndefinability.AcceptsUndefinedOnly,
                  underlyingType: {
                    kind: "scalar",
                    name: "String",
                    type: "named",
                  },
                },
              },
              {
                propertyName: "nullOrUndefinedString",
                type: {
                  type: "nullable",
                  nullOrUndefinability: NullOrUndefinability.AcceptsEither,
                  underlyingType: {
                    kind: "scalar",
                    name: "String",
                    type: "named",
                  },
                },
              },
            ],
          },
        },
        scalarTypes: {
          String: {},
        },
      }
    })
  });

  it("recursive types", function() {
    const schema = deriveSchema(require.resolve("./recursive-types.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {},
      functionsSchema: {
        functions: {
          "bar": {
            ndcKind: FunctionNdcKind.Procedure,
            description: null,
            parallelDegree: null,
            arguments: [],
            resultType: {
              type: "named",
              kind: "object",
              name: "Foo"
            }
          }
        },
        objectTypes: {
          Foo: {
            properties: [
              {
                propertyName: "a",
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "Float"
                }
              },
              {
                propertyName: "b",
                type: {
                  type: "array",
                  elementType: {
                    type: "named",
                    kind: "object",
                    name: "Foo"
                  }
                }
              }
            ]
          },
        },
        scalarTypes: {
          Float: {},
        },
      }
    })
  });

  it("literal types", function() {
    const schema = deriveSchema(require.resolve("./literal-types.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {},
      functionsSchema: {
        scalarTypes: {
          BigInt: {},
          Boolean: {},
          Float: {},
          String: {},
        },
        functions: {
          "literalTypes": {
            ndcKind: FunctionNdcKind.Procedure,
            description: null,
            arguments: [],
            parallelDegree: null,
            resultType: {
              name: "LiteralProps",
              kind: "object",
              type: "named",
            }
          },
        },
        objectTypes: {
          "LiteralProps": {
            properties: [
              {
                propertyName: "literalString",
                type: {
                  type: "named",
                  kind: "scalar",
                  name: BuiltInScalarTypeName.String,
                  literalValue: "literal-string"
                }
              },
              {
                propertyName: "literalNumber",
                type: {
                  type: "named",
                  kind: "scalar",
                  name: BuiltInScalarTypeName.Float,
                  literalValue: 123,
                }
              },
              {
                propertyName: "literalBoolean",
                type: {
                  type: "named",
                  kind: "scalar",
                  name: BuiltInScalarTypeName.Boolean,
                  literalValue: true,
                }
              },
              {
                propertyName: "literalBigInt",
                type: {
                  type: "named",
                  kind: "scalar",
                  name: BuiltInScalarTypeName.BigInt,
                  literalValue: -123n,
                }
              },
              {
                propertyName: "literalStringEnum",
                type: {
                  type: "named",
                  kind: "scalar",
                  name: BuiltInScalarTypeName.String,
                  literalValue: "EnumItem",
                }
              },
              {
                propertyName: "literalNumericEnum",
                type: {
                  type: "named",
                  kind: "scalar",
                  name: BuiltInScalarTypeName.Float,
                  literalValue: 0,
                }
              }
            ]
          }
        },
      }
    })
  });
});
