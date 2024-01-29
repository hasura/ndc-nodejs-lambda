import { describe, it } from "mocha";
import { assert } from "chai";
import { deriveSchema } from "../../../src/inference";
import { BuiltInScalarTypeName, FunctionNdcKind, NullOrUndefinability } from "../../../src/schema";

describe("type descriptions", function() {
  it("descriptions are derived for function and function arguments", function() {
    const schema = deriveSchema(require.resolve("./functions.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {},
      functionsSchema: {
        functions: {
          "myFunction": {
            ndcKind: FunctionNdcKind.Function,
            description: "My cool function. It's a great function.\nYou should totally use it.",
            parallelDegree: null,
            arguments: [
              {
                argumentName: "amaze",
                description: "This is a great and amazing param.\nDefinitely pass something for it.",
                type: {
                  name: "String",
                  kind: "scalar",
                  type: "named",
                }
              },
            ],
            resultType: {
              name: "String",
              kind: "scalar",
              type: "named",
            }
          },
        },
        scalarTypes: {
          String: {},
        },
        objectTypes: {},
      }
    })
  });

  it("descriptions are derived for object types and their properties", function() {
    const schema = deriveSchema(require.resolve("./object-types.ts"));

    assert.deepStrictEqual(schema, {
      compilerDiagnostics: [],
      functionIssues: {},
      functionsSchema: {
        functions: {
          "myFunction": {
            ndcKind: FunctionNdcKind.Function,
            description: null,
            parallelDegree: null,
            arguments: [
              {
                argumentName: "myObjType",
                description: null,
                type: {
                  name: "MyObjType",
                  kind: "object",
                  type: "named",
                }
              },
              {
                argumentName: "iface",
                description: null,
                type: {
                  name: "IInterface",
                  kind: "object",
                  type: "named",
                }
              },
              {
                argumentName: "genericInterface",
                description: null,
                type: {
                  name: "IGenericInterface",
                  kind: "object",
                  type: "named",
                }
              },
              {
                argumentName: "intersectionType",
                description: null,
                type: {
                  name: "IntersectionType",
                  kind: "object",
                  type: "named",
                }
              },
            ],
            resultType: {
              name: "String",
              kind: "scalar",
              type: "named",
            }
          },
        },
        scalarTypes: {
          String: {},
        },
        objectTypes: {
          "MyObjType": {
            description: "My object type is the best object type.\nYou should make all object types like mine.",
            properties: [
              {
                propertyName: "propA",
                description: "This is a good property",
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "String"
                }
              }
            ]
          },
          "IInterface": {
            description: "What a great interface",
            properties: [
              {
                propertyName: "prop",
                description: "The best of all properties",
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "String"
                }
              }
            ]
          },
          "IGenericInterface": {
            description: "The most generic of interfaces",
            properties: [
              {
                propertyName: "whatever",
                description: "Whatever you'd like it to be",
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "String"
                }
              }
            ]
          },
          "IntersectionType": {
            description: "Just smashing things together over here",
            properties: [
              {
                propertyName: "propA",
                description: "This is a good property",
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "String"
                }
              },
              {
                propertyName: "anotherProp",
                description: "I'm just adding another prop here",
                type: {
                  type: "named",
                  kind: "scalar",
                  name: "String"
                }
              }
            ]
          }
        },
      }
    })
  });
});
