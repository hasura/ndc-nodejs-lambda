import { describe, it } from "mocha";
import { assert } from "chai";
import * as sdk from "@hasura/ndc-sdk-typescript"
import { reshapeResultToNdcResponseValue } from "../../src/execution";
import { ArrayTypeReference, BuiltInScalarTypeName, JSONValue, NamedTypeReference, NullOrUndefinability, NullableTypeReference, ObjectTypeDefinitions } from "../../src/schema";

describe("reshape result", function() {

  describe("serializes scalar types", function() {
    const testCases = [
      {
        testName: "Float",
        value: 123.456,
        type: BuiltInScalarTypeName.Float,
        reshapedValue: 123.456
      },
      {
        testName: "String",
        value: "123.456",
        type: BuiltInScalarTypeName.String,
        reshapedValue: "123.456"
      },
      {
        testName: "Boolean",
        value: true,
        type: BuiltInScalarTypeName.Boolean,
        reshapedValue: true
      },
      {
        testName: "BigInt",
        value: 123n,
        type: BuiltInScalarTypeName.BigInt,
        reshapedValue: "123"
      },
      {
        testName: "DateTime",
        value: new Date("2024-01-11T14:45:23Z"),
        type: BuiltInScalarTypeName.DateTime,
        reshapedValue: "2024-01-11T14:45:23.000Z"
      },
      {
        testName: "JSON",
        value: new JSONValue({some: "random", json: { object: true }}),
        type: BuiltInScalarTypeName.JSON,
        reshapedValue: {some: "random", json: { object: true }}
      },
    ]

    for (const testCase of testCases) {
      it(testCase.testName, function () {
        const scalarType: NamedTypeReference = { type: "named", kind: "scalar", name: testCase.type };
        const result = reshapeResultToNdcResponseValue(testCase.value, scalarType, [], "AllColumns", {});
        assert.deepStrictEqual(result, testCase.reshapedValue);
      })
    }
  });

  describe("coerces nullable types", function() {
    const testCases = [
      {
        testName: "Null -> Null",
        value: null,
        scalarType: BuiltInScalarTypeName.String,
        reshapedValue: null
      },
      {
        testName: "Undefined -> Null",
        value: undefined,
        scalarType: BuiltInScalarTypeName.String,
        reshapedValue: null
      },
      {
        testName: "String -> String",
        value: "",
        scalarType: BuiltInScalarTypeName.String,
        reshapedValue: ""
      },
    ]

    for (const testCase of testCases) {
      it(testCase.testName, function () {
        const nullableType: NullableTypeReference = { type: "nullable", nullOrUndefinability: NullOrUndefinability.AcceptsEither, underlyingType: { type: "named", kind: "scalar", name: testCase.scalarType } };
        const result = reshapeResultToNdcResponseValue(testCase.value, nullableType, [], "AllColumns", {});
        assert.strictEqual(result, testCase.reshapedValue);
      })
    }
  });

  describe("projects object types using fields", function() {
    const objectTypes: ObjectTypeDefinitions = {
      "TestObjectType": {
        description: null,
        properties: [
          {
            propertyName: "propA",
            description: null,
            type: { type: "named", kind: "scalar", name: BuiltInScalarTypeName.String }
          },
          {
            propertyName: "propB",
            description: null,
            type: { type: "named", kind: "scalar", name: BuiltInScalarTypeName.String }
          },
          {
            propertyName: "nested",
            description: null,
            type: { type: "nullable", nullOrUndefinability: NullOrUndefinability.AcceptsEither, underlyingType: { type: "named", kind: "object", name: "TestObjectType" } }
          }
        ],
        isRelaxedType: false,
      }
    }
    const testCases = [
      {
        testName: "AllColumns",
        value: { propA: "valueA", propB: "valueB", nested: { propA: "nestedValueA", propB: "nestedValueB" } },
        fields: "AllColumns" as const,
        reshapedValue: { propA: "valueA", propB: "valueB", nested: { propA: "nestedValueA", propB: "nestedValueB", nested: null } },
      },
      {
        testName: "propA, propB, nested",
        value: { propA: "valueA", propB: "valueB", nested: { propA: "nestedValueA", propB: "nestedValueB" } },
        fields: <Record<string, sdk.Field>>{ propA: { type: "column", column: "propA" }, propB: { type: "column", column: "propB" }, nested: { type: "column", column: "nested" } },
        reshapedValue: { propA: "valueA", propB: "valueB", nested: { propA: "nestedValueA", propB: "nestedValueB", nested: null } },
      },
      {
        testName: "renamedPropA:propA, renamedPropB:propB",
        value: { propA: "valueA", propB: "valueB", nested: { propA: "nestedValueA", propB: "nestedValueB" } },
        fields: <Record<string, sdk.Field>>{ renamedPropA: { type: "column", column: "propA" }, renamedPropB: { type: "column", column: "propB" } },
        reshapedValue: { renamedPropA: "valueA", renamedPropB: "valueB" },
      },
      {
        testName: "propB",
        value: { propA: "valueA", propB: "valueB", nested: { propA: "nestedValueA", propB: "nestedValueB" } },
        fields: <Record<string, sdk.Field>>{ propB: { type: "column", column: "propB" } },
        reshapedValue: { propB: "valueB" },
      },
      {
        testName: "propB, duplicatedPropB",
        value: { propA: "valueA", propB: "valueB", nested: { propA: "nestedValueA", propB: "nestedValueB" } },
        fields: <Record<string, sdk.Field>>{ propB: { type: "column", column: "propB" }, duplicatedPropB: { type: "column", column: "propB" } },
        reshapedValue: { propB: "valueB", duplicatedPropB: "valueB" },
      },
      {
        testName: "missingProp:nested",
        value: { propA: "valueA", propB: "valueB" },
        fields: <Record<string, sdk.Field>>{ missingProp: { type: "column", column: "nested" } },
        reshapedValue: { missingProp: null },
      },
    ]

    for (const testCase of testCases) {
      it(testCase.testName, function () {
        const objectType: NamedTypeReference = { type: "named", kind: "object", name: "TestObjectType" };
        const result = reshapeResultToNdcResponseValue(testCase.value, objectType, [], testCase.fields, objectTypes);
        assert.deepStrictEqual(result, testCase.reshapedValue);
      })
    }
  });

  it("serializes scalar array type", function() {
    const arrayType: ArrayTypeReference = { type: "array", elementType: { type: "named", kind: "scalar", name: BuiltInScalarTypeName.Float } };
    const result = reshapeResultToNdcResponseValue([1,2,3], arrayType, [], "AllColumns", {});
    assert.deepStrictEqual(result, [1,2,3]);
  });

  describe("projects object types using fields through an array type", function() {
    const objectTypes: ObjectTypeDefinitions = {
      "TestObjectType": {
        description: null,
        properties: [
          {
            propertyName: "propA",
            description: null,
            type: { type: "named", kind: "scalar", name: BuiltInScalarTypeName.String }
          },
          {
            propertyName: "propB",
            description: null,
            type: { type: "nullable", nullOrUndefinability: NullOrUndefinability.AcceptsEither, underlyingType: { type: "named", kind: "scalar", name: BuiltInScalarTypeName.String } }
          }
        ],
        isRelaxedType: false,
      }
    }
    const testCases = [
      {
        testName: "AllColumns",
        value: [
          { propA: "valueA1", propB: "valueB1" },
          { propA: "valueA2", propB: "valueB2" },
        ],
        fields: "AllColumns" as const,
        reshapedValue: [
          { propA: "valueA1", propB: "valueB1" },
          { propA: "valueA2", propB: "valueB2" },
        ],
      },
      {
        testName: "propA, propB",
        value: [
          { propA: "valueA1", propB: "valueB1" },
          { propA: "valueA2", propB: "valueB2" },
        ],
        fields: <Record<string, sdk.Field>>{ propA: { type: "column", column: "propA" }, propB: { type: "column", column: "propB" } },
        reshapedValue: [
          { propA: "valueA1", propB: "valueB1" },
          { propA: "valueA2", propB: "valueB2" },
        ],
      },
      {
        testName: "renamedPropA:propA, renamedPropB:propB",
        value: [
          { propA: "valueA1", propB: "valueB1" },
          { propA: "valueA2", propB: "valueB2" },
        ],
        fields: <Record<string, sdk.Field>>{ renamedPropA: { type: "column", column: "propA" }, renamedPropB: { type: "column", column: "propB" } },
        reshapedValue: [
          { renamedPropA: "valueA1", renamedPropB: "valueB1" },
          { renamedPropA: "valueA2", renamedPropB: "valueB2" },
        ],
      },
      {
        testName: "propB",
        value: [
          { propA: "valueA1", propB: "valueB1" },
          { propA: "valueA2", propB: "valueB2" },
        ],
        fields: <Record<string, sdk.Field>>{ propB: { type: "column", column: "propB" } },
        reshapedValue: [
          { propB: "valueB1" },
          { propB: "valueB2" },
        ],
      },
      {
        testName: "propB, duplicatedPropB",
        value: [
          { propA: "valueA1", propB: "valueB1" },
          { propA: "valueA2", propB: "valueB2" },
        ],
        fields: <Record<string, sdk.Field>>{ propB: { type: "column", column: "propB" }, duplicatedPropB: { type: "column", column: "propB" } },
        reshapedValue: [
          { propB: "valueB1", duplicatedPropB: "valueB1" },
          { propB: "valueB2", duplicatedPropB: "valueB2" },
        ],
      },
      {
        testName: "missingProp:propB",
        value: [
          { propA: "valueA1" },
          { propA: "valueA2", propB: "valueB2" },
        ],
        fields: <Record<string, sdk.Field>>{ missingProp: { type: "column", column: "propB" } },
        reshapedValue: [
          { missingProp: null },
          { missingProp: "valueB2" }
        ],
      },
    ]

    for (const testCase of testCases) {
      it(testCase.testName, function () {
        const arrayType: ArrayTypeReference = { type: "array", elementType: { type: "named", kind: "object", name: "TestObjectType" } };
        const result = reshapeResultToNdcResponseValue(testCase.value, arrayType, [], testCase.fields, objectTypes);
        assert.deepStrictEqual(result, testCase.reshapedValue);
      })
    }
  });
});
