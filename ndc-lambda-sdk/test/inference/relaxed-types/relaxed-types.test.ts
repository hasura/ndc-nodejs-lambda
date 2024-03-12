import { describe, it } from "mocha";
import { assert } from "chai";
import { deriveSchema } from "../../../src/inference";
import { FunctionNdcKind, NullOrUndefinability } from "../../../src/schema";

describe("relaxed types", function() {
  it("any", function() {
    const schema = deriveSchema(require.resolve("./any.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {},
      functionsSchema: {
        scalarTypes: {
          "any": {
            type: "relaxed-type",
            usedIn: [
              [
                {
                  functionName: "anyFunction",
                  parameterName: "test",
                  segmentType: "FunctionParameter",
                }
              ],
              [
                {
                  functionName: "anyFunction",
                  segmentType: "FunctionReturn",
                }
              ]
            ]
          },
        },
        objectTypes: {},
        functions: {
          "anyFunction": {
            description: null,
            ndcKind: FunctionNdcKind.Procedure,
            parallelDegree: null,
            arguments: [
              {
                argumentName: "test",
                description: null,
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "any",
                }
              }
            ],
            resultType: {
              type: "named",
              kind: "scalar",
              name: "any",
            }
          }
        }
      }
    })
  });

  it("unknown", function() {
    const schema = deriveSchema(require.resolve("./unknown.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {},
      functionsSchema: {
        scalarTypes: {
          "String": { type: "built-in" },
          "unknown": {
            type: "relaxed-type",
            usedIn: [
              [
                {
                  functionName: "unknownFunction",
                  parameterName: "test",
                  segmentType: "FunctionParameter",
                }
              ]
            ]
          },
        },
        objectTypes: {},
        functions: {
          "unknownFunction": {
            description: null,
            ndcKind: FunctionNdcKind.Procedure,
            parallelDegree: null,
            arguments: [
              {
                argumentName: "test",
                description: null,
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "unknown",
                }
              }
            ],
            resultType: {
              type: "named",
              kind: "scalar",
              name: "String",
            }
          }
        }
      }
    })
  });

  describe("tuple types", function() {
    it("valid", function() {
      const schema = deriveSchema(require.resolve("./tuple-types-valid.ts"));

      assert.deepStrictEqual(schema, {
        compilerDiagnostics: [],
        functionIssues: {},
        functionsSchema: {
          scalarTypes: {
            "String": { type: "built-in" },
            "[string]": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "tupleFunction",
                    parameterName: "tuple1",
                    segmentType: "FunctionParameter",
                  }
                ]
              ]
            },
            "[string, number]": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "tupleFunction",
                    parameterName: "tuple2",
                    segmentType: "FunctionParameter",
                  }
                ]
              ]
            },
            "Tuple<number, boolean>": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "tupleFunction",
                    parameterName: "tupleAlias",
                    segmentType: "FunctionParameter",
                  }
                ]
              ]
            },
          },
          objectTypes: {},
          functions: {
            "tupleFunction": {
              description: null,
              ndcKind: FunctionNdcKind.Procedure,
              parallelDegree: null,
              arguments: [
                {
                  argumentName: "tuple1",
                  description: null,
                  type: {
                    type: "named",
                    kind: "scalar",
                    name: "[string]",
                  }
                },
                {
                  argumentName: "tuple2",
                  description: null,
                  type: {
                    type: "named",
                    kind: "scalar",
                    name: "[string, number]",
                  }
                },
                {
                  argumentName: "tupleAlias",
                  description: null,
                  type: {
                    type: "named",
                    kind: "scalar",
                    name: "Tuple<number, boolean>",
                  }
                },
              ],
              resultType: {
                type: "named",
                kind: "scalar",
                name: "String",
              }
            },
          }
        }
      })
    });

    it("invalid", function() {
      const schema = deriveSchema(require.resolve("./tuple-types-invalid.ts"));

      assert.deepStrictEqual(schema, {
        compilerDiagnostics: [],
        functionIssues: {
          "tupleFunction": [
            "The void type is not supported, but one was encountered in function 'tupleFunction' parameter 'tuple1', type '[void]' type parameter index '0'",
            "The never type is not supported, but one was encountered in function 'tupleFunction' parameter 'tuple2', type '[string, never]' type parameter index '1'",
            "Promise types are not supported, but one was encountered in function 'tupleFunction' parameter 'tupleAlias', type 'Tuple<number, Promise<boolean>>' type parameter index '1'.",
          ]
        },
        functionsSchema: {
          scalarTypes: {
            "String": { type: "built-in" },
          },
          objectTypes: {},
          functions: {}
        }
      })
    });
  });

  describe("index signature types", function() {
    it("valid", function() {
      const schema = deriveSchema(require.resolve("./index-signature-types-valid.ts"));

      assert.deepStrictEqual(schema, {
        compilerDiagnostics: [],
        functionIssues: {},
        functionsSchema: {
          scalarTypes: {
            "String": { type: "built-in" },
            "Record<string, string>": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "indexSignatureTypesFunction",
                    parameterName: "recordType",
                    segmentType: "FunctionParameter",
                  }
                ]
              ]
            },
            "{ [x: string]: string; }": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "indexSignatureTypesFunction",
                    parameterName: "inlineSig",
                    segmentType: "FunctionParameter",
                  }
                ]
              ]
            },
            "ObjectWithIndexSignature": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "indexSignatureTypesFunction",
                    parameterName: "objWithSig",
                    segmentType: "FunctionParameter",
                  }
                ]
              ]
            },
            "ObjectWithPropsAndIndexSignature": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "indexSignatureTypesFunction",
                    parameterName: "objWithPropsAndSig",
                    segmentType: "FunctionParameter",
                  }
                ]
              ]
            },
            "IntersectionOfMultipleIndexSigs": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "indexSignatureTypesFunction",
                    parameterName: "intersectionSigs",
                    segmentType: "FunctionParameter",
                  }
                ]
              ]
            }
          },
          objectTypes: {},
          functions: {
            "indexSignatureTypesFunction": {
              description: null,
              ndcKind: FunctionNdcKind.Procedure,
              parallelDegree: null,
              arguments: [
                {
                  argumentName: "recordType",
                  description: null,
                  type: {
                    type: "named",
                    kind: "scalar",
                    name: "Record<string, string>",
                  }
                },
                {
                  argumentName: "inlineSig",
                  description: null,
                  type: {
                    type: "named",
                    kind: "scalar",
                    name: "{ [x: string]: string; }",
                  }
                },
                {
                  argumentName: "objWithSig",
                  description: null,
                  type: {
                    type: "named",
                    kind: "scalar",
                    name: "ObjectWithIndexSignature",
                  }
                },
                {
                  argumentName: "objWithPropsAndSig",
                  description: null,
                  type: {
                    type: "named",
                    kind: "scalar",
                    name: "ObjectWithPropsAndIndexSignature",
                  }
                },
                {
                  argumentName: "intersectionSigs",
                  description: null,
                  type: {
                    type: "named",
                    kind: "scalar",
                    name: "IntersectionOfMultipleIndexSigs",
                  }
                },
              ],
              resultType: {
                type: "named",
                kind: "scalar",
                name: "String",
              }
            },
          }
        }
      })
    });

    it("invalid", function() {
      const schema = deriveSchema(require.resolve("./index-signature-types-invalid.ts"));

      assert.deepStrictEqual(schema, {
        compilerDiagnostics: [],
        functionIssues: {
          "indexSignatureTypesFunction": [
            "The void type is not supported, but one was encountered in function 'indexSignatureTypesFunction' parameter 'recordType', type 'Record<string, void>' type signature index '0' value type",
            "The undefined type is not supported as a type literal used on its own, but one was encountered in function 'indexSignatureTypesFunction' parameter 'inlineSig', type '{ [x: string]: undefined; }' type signature index '0' value type",
            "The never type is not supported, but one was encountered in function 'indexSignatureTypesFunction' parameter 'objWithSig', type 'ObjectWithIndexSignature' type signature index '0' value type",
            "Promise types are not supported, but one was encountered in function 'indexSignatureTypesFunction' parameter 'objWithPropsAndSig', type 'ObjectWithPropsAndIndexSignature' type signature index '0' value type.",
            "Promise types are not supported, but one was encountered in function 'indexSignatureTypesFunction' parameter 'intersectionSigs', type 'IntersectionOfMultipleIndexSigs' type signature index '1' value type."
          ]
        },
        functionsSchema: {
          scalarTypes: {
            "String": { type: "built-in" },
          },
          objectTypes: {},
          functions: {}
        }
      })
    });
  });

  describe("union types", function() {
    it("valid", function() {
      const schema = deriveSchema(require.resolve("./union-types-valid.ts"));

      assert.deepStrictEqual(schema, {
        compilerDiagnostics: [],
        functionIssues: {},
        functionsSchema: {
          scalarTypes: {
            "String": { type: "built-in" },
            "string | number": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "unionTypes",
                    parameterName: "numberOrString",
                    segmentType: "FunctionParameter",
                  }
                ]
              ]
            },
            "AliasedUnion": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "unionTypes",
                    parameterName: "aliasedUnion",
                    segmentType: "FunctionParameter",
                  }
                ]
              ]
            },
            "{ prop1: string; } | { prop2: string; }": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "unionTypes",
                    parameterName: "unionedObjects",
                    segmentType: "FunctionParameter",
                  }
                ]
              ]
            },
          },
          objectTypes: {},
          functions: {
            "unionTypes": {
              description: null,
              ndcKind: FunctionNdcKind.Procedure,
              parallelDegree: null,
              arguments: [
                {
                  argumentName: "numberOrString",
                  description: null,
                  type: {
                    type: "named",
                    kind: "scalar",
                    name: "string | number",
                  }
                },
                {
                  argumentName: "aliasedUnion",
                  description: null,
                  type: {
                    type: "named",
                    kind: "scalar",
                    name: "AliasedUnion",
                  }
                },
                {
                  argumentName: "unionedObjects",
                  description: null,
                  type: {
                    type: "named",
                    kind: "scalar",
                    name: "{ prop1: string; } | { prop2: string; }",
                  }
                },
              ],
              resultType: {
                type: "named",
                kind: "scalar",
                name: "String",
              }
            },
          }
        }
      })
    });

    it("invalid", function() {
      const schema = deriveSchema(require.resolve("./union-types-invalid.ts"));

      assert.deepStrictEqual(schema, {
        compilerDiagnostics: [],
        functionIssues: {
          "unionTypes": [
            "Promise types are not supported, but one was encountered in function 'unionTypes' parameter 'numberOrString', type 'number | Promise<string>' union member index '1'.",
            "The void type is not supported, but one was encountered in function 'unionTypes' parameter 'aliasedUnion', type 'AliasedUnion' union member index '1'",
            "The never type is not supported, but one was encountered in function 'unionTypes' parameter 'unionedObjects', type '{ prop1: never; } | { prop2: string; }' union member index '0', type 'unionTypes_arguments_unionedObjects_union_0' property 'prop1'",
          ]
        },
        functionsSchema: {
          scalarTypes: {
            "String": { type: "built-in" },
          },
          objectTypes: {},
          functions: {}
        }
      })
    });
  });

  describe("enum types", function() {
    it("valid", function() {
      const schema = deriveSchema(require.resolve("./enum-types-valid.ts"));

      assert.deepStrictEqual(schema, {
        compilerDiagnostics: [],
        functionIssues: {},
        functionsSchema: {
          scalarTypes: {
            "\"1st\" | \"2nd\"": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "enumTypesFunction",
                    parameterName: "inlineStringLiteralEnum",
                    segmentType: "FunctionParameter",
                  }
                ],
                [
                  {
                    functionName: "enumTypesFunction",
                    parameterName: "inlineStringLiteralEnumMaybe",
                    segmentType: "FunctionParameter",
                  }
                ],
              ]
            },
            "0 | 1 | 2": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "enumTypesFunction",
                    parameterName: "inlineNumberLiteralEnum",
                    segmentType: "FunctionParameter",
                  }
                ],
                [
                  {
                    functionName: "enumTypesFunction",
                    parameterName: "inlineNumberLiteralEnumMaybe",
                    segmentType: "FunctionParameter",
                  }
                ],
              ]
            },
            "ComputedEnum": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "enumTypesFunction",
                    parameterName: "computedEnum",
                    segmentType: "FunctionParameter",
                  }
                ]
              ]
            },
            "ComputedSingleItemEnum": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "enumTypesFunction",
                    parameterName: "computedSingleItemEnum",
                    segmentType: "FunctionParameter",
                  }
                ]
              ]
            },
            "ConstEnum": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "enumTypesFunction",
                    parameterName: "constEnum",
                    segmentType: "FunctionParameter",
                  }
                ]
              ]
            },
            "ConstObjEnum": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "enumTypesFunction",
                    parameterName: "constObjEnum",
                    segmentType: "FunctionParameter",
                  }
                ],
              ]
            },
            "MixedEnum": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "enumTypesFunction",
                    parameterName: "mixedEnum",
                    segmentType: "FunctionParameter",
                  }
                ]
              ]
            },
            "MixedLiteralEnum": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "enumTypesFunction",
                    parameterName: "mixedLiteralEnum",
                    segmentType: "FunctionParameter",
                  }
                ],
                [
                  {
                    functionName: "enumTypesFunction",
                    parameterName: "mixedLiteralEnumMaybe",
                    segmentType: "FunctionParameter",
                  }
                ],
              ]
            },
            "NumberEnum": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "enumTypesFunction",
                    parameterName: "numberEnum",
                    segmentType: "FunctionParameter",
                  }
                ]
              ]
            },
            "NumberLiteralEnum": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "enumTypesFunction",
                    parameterName: "numberLiteralEnum",
                    segmentType: "FunctionParameter",
                  }
                ],
                [
                  {
                    functionName: "enumTypesFunction",
                    parameterName: "numberLiteralEnumMaybe",
                    segmentType: "FunctionParameter",
                  }
                ],
              ]
            },
            "String": { type: "built-in" },
            "StringEnum": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "enumTypesFunction",
                    parameterName: "stringEnum",
                    segmentType: "FunctionParameter",
                  }
                ]
              ]
            },
            "StringLiteralEnum": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "enumTypesFunction",
                    parameterName: "stringLiteralEnum",
                    segmentType: "FunctionParameter",
                  }
                ],
                [
                  {
                    functionName: "enumTypesFunction",
                    parameterName: "stringLiteralEnumMaybe",
                    segmentType: "FunctionParameter",
                  }
                ],
              ]
            },
            "true | 1 | \"first\"": {
              type: "relaxed-type",
              usedIn: [
                [
                  {
                    functionName: "enumTypesFunction",
                    parameterName: "inlineMixedLiteralEnum",
                    segmentType: "FunctionParameter",
                  }
                ],
                [
                  {
                    functionName: "enumTypesFunction",
                    parameterName: "inlineMixedLiteralEnumMaybe",
                    segmentType: "FunctionParameter",
                  }
                ],
              ]
            },
          },
          objectTypes: {},
          functions: {
            "enumTypesFunction": {
              description: null,
              ndcKind: FunctionNdcKind.Function,
              parallelDegree: null,
              arguments: [
                {
                  argumentName: "stringEnum",
                  description: null,
                  type: {
                    kind: "scalar",
                    name: "StringEnum",
                    type: "named",
                  },
                },
                {
                  argumentName: "numberEnum",
                  description: null,
                  type: {
                    kind: "scalar",
                    name: "NumberEnum",
                    type: "named",
                  },
                },
                {
                  argumentName: "mixedEnum",
                  description: null,
                  type: {
                    kind: "scalar",
                    name: "MixedEnum",
                    type: "named",
                  },
                },
                {
                  argumentName: "constEnum",
                  description: null,
                  type: {
                    kind: "scalar",
                    name: "ConstEnum",
                    type: "named",
                  },
                },
                {
                  argumentName: "computedEnum",
                  description: null,
                  type: {
                    kind: "scalar",
                    name: "ComputedEnum",
                    type: "named",
                  },
                },
                {
                  argumentName: "computedSingleItemEnum",
                  description: null,
                  type: {
                    kind: "scalar",
                    name: "ComputedSingleItemEnum",
                    type: "named",
                  },
                },
                {
                  argumentName: "stringLiteralEnum",
                  description: null,
                  type: {
                    kind: "scalar",
                    name: "StringLiteralEnum",
                    type: "named",
                  },
                },
                {
                  argumentName: "stringLiteralEnumMaybe",
                  description: null,
                  type: {
                    type: "nullable",
                    nullOrUndefinability: NullOrUndefinability.AcceptsUndefinedOnly,
                    underlyingType: {
                      kind: "scalar",
                      name: "StringLiteralEnum",
                      type: "named",
                    },
                  },
                },
                {
                  argumentName: "inlineStringLiteralEnum",
                  description: null,
                  type: {
                    kind: "scalar",
                    name: "\"1st\" | \"2nd\"",
                    type: "named",
                  },
                },
                {
                  argumentName: "inlineStringLiteralEnumMaybe",
                  description: null,
                  type: {
                    type: "nullable",
                    nullOrUndefinability: NullOrUndefinability.AcceptsNullOnly,
                    underlyingType: {
                      kind: "scalar",
                      name: "\"1st\" | \"2nd\"",
                      type: "named",
                    },
                  },
                },
                {
                  argumentName: "numberLiteralEnum",
                  description: null,
                  type: {
                    kind: "scalar",
                    name: "NumberLiteralEnum",
                    type: "named",
                  },
                },
                {
                  argumentName: "numberLiteralEnumMaybe",
                  description: null,
                  type: {
                    nullOrUndefinability: NullOrUndefinability.AcceptsNullOnly,
                    type: "nullable",
                    underlyingType: {
                      kind: "scalar",
                      name: "NumberLiteralEnum",
                      type: "named",
                    },
                  },
                },
                {
                  argumentName: "inlineNumberLiteralEnum",
                  description: null,
                  type: {
                    kind: "scalar",
                    name: "0 | 1 | 2",
                    type: "named",
                  },
                },
                {
                  argumentName: "inlineNumberLiteralEnumMaybe",
                  description: null,
                  type: {
                    nullOrUndefinability: NullOrUndefinability.AcceptsUndefinedOnly,
                    type: "nullable",
                    underlyingType: {
                      kind: "scalar",
                      name: "0 | 1 | 2",
                      type: "named",
                    },
                  },
                },
                {
                  argumentName: "mixedLiteralEnum",
                  description: null,
                  type: {
                    kind: "scalar",
                    name: "MixedLiteralEnum",
                    type: "named",
                  },
                },
                {
                  argumentName: "mixedLiteralEnumMaybe",
                  description: null,
                  type: {
                    nullOrUndefinability: NullOrUndefinability.AcceptsEither,
                    type: "nullable",
                    underlyingType: {
                      kind: "scalar",
                      name: "MixedLiteralEnum",
                      type: "named",
                    },
                  },
                },
                {
                  argumentName: "inlineMixedLiteralEnum",
                  description: null,
                  type: {
                    kind: "scalar",
                    name: "true | 1 | \"first\"",
                    type: "named",
                  },
                },
                {
                  argumentName: "inlineMixedLiteralEnumMaybe",
                  description: null,
                  type: {
                    nullOrUndefinability: NullOrUndefinability.AcceptsEither,
                    type: "nullable",
                    underlyingType: {
                      kind: "scalar",
                      name: "true | 1 | \"first\"",
                      type: "named",
                    },
                  },
                },
                {
                  argumentName: "constObjEnum",
                  description: null,
                  type: {
                    kind: "scalar",
                    name: "ConstObjEnum",
                    type: "named",
                  },
                },
              ],
              resultType: {
                type: "named",
                kind: "scalar",
                name: "String",
              }
            },
          }
        }
      })
    });

    it("invalid", function() {
      const schema = deriveSchema(require.resolve("./enum-types-invalid.ts"));

      assert.deepStrictEqual(schema, {
        compilerDiagnostics: [],
        functionIssues: {
          "enumTypesFunction": [
            "Promise types are not supported, but one was encountered in function 'enumTypesFunction' parameter 'stringLiteralEnum', type 'StringLiteralEnum' union member index '0'.",
            "The void type is not supported, but one was encountered in function 'enumTypesFunction' parameter 'inlineStringLiteralEnum', type 'void | \"1st\" | \"2nd\"' union member index '0'",
          ]
        },
        functionsSchema: {
          scalarTypes: {
            "String": { type: "built-in" },
          },
          objectTypes: {},
          functions: {}
        }
      })
    });
  });

  it("used in object types", function() {
    const schema = deriveSchema(require.resolve("./used-in-object-types.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {
        "strictTest": [
          "The object type 'ObjectWithRelaxedType' uses relaxed types and can only be used by a function marked with @allowrelaxedtypes. It was encountered in function 'strictTest' parameter 'param'"
        ]
      },
      functionsSchema: {
        scalarTypes: {
          "String": { type: "built-in" },
          "string | number": {
            type: "relaxed-type",
            usedIn: [
              [
                {
                  segmentType: "FunctionParameter",
                  functionName: "relaxedTest",
                  parameterName: "param",
                },
                {
                  segmentType: "ObjectProperty",
                  typeName: "ObjectWithRelaxedType",
                  propertyName: "prop",
                },
              ]
            ]
          },
        },
        objectTypes: {
          "ObjectWithRelaxedType": {
            description: null,
            properties: [
              {
                propertyName: "prop",
                description: null,
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "string | number",
                }
              }
            ],
            isRelaxedType: true,
          }
        },
        functions: {
          "relaxedTest": {
            description: null,
            ndcKind: FunctionNdcKind.Procedure,
            parallelDegree: null,
            arguments: [
              {
                argumentName: "param",
                description: null,
                type: {
                  type: "named",
                  kind: "object",
                  name: "ObjectWithRelaxedType",
                }
              }
            ],
            resultType: {
              type: "named",
              kind: "scalar",
              name: "String",
            }
          }
        }
      }
    })
  });

});
