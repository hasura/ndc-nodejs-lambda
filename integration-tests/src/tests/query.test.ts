import { expect } from "chai";
import { client } from "./root-hooks";

function makeQueryRequest(
  collection: string,
  args: Record<string, unknown>,
  fields?: Record<string, { type: string; column: string }>,
  variables?: Record<string, unknown>[]
): object {
  const request: any = {
    collection,
    query: {
      fields: fields ?? {
        __value: { type: "column", column: "__value" },
      },
    },
    arguments: Object.fromEntries(
      Object.entries(args).map(([k, v]) => [k, { type: "literal", value: v }])
    ),
    collection_relationships: {},
  };
  if (variables) {
    request.variables = variables;
  }
  return request;
}

function makeVariableQueryRequest(
  collection: string,
  literalArgs: Record<string, unknown>,
  variableArgs: Record<string, string>,
  variables: Record<string, unknown>[]
): object {
  const arguments_: Record<string, any> = {};
  for (const [k, v] of Object.entries(literalArgs)) {
    arguments_[k] = { type: "literal", value: v };
  }
  for (const [k, v] of Object.entries(variableArgs)) {
    arguments_[k] = { type: "variable", name: v };
  }
  return {
    collection,
    query: {
      fields: {
        __value: { type: "column", column: "__value" },
      },
    },
    arguments: arguments_,
    collection_relationships: {},
    variables,
  };
}

async function queryScalar(collection: string, args: Record<string, unknown>): Promise<any> {
  const response = await client.postQuery(makeQueryRequest(collection, args));
  expect(response.status).to.equal(200);
  const body: any = await response.json();
  return body[0]?.rows?.[0]?.__value;
}

describe("Query tests", function () {
  describe("scalar types", function () {
    it("hello with no args returns default greeting", async function () {
      const result = await queryScalar("hello", {});
      expect(result).to.equal("hello world");
    });

    it("hello with name arg returns personalized greeting", async function () {
      const result = await queryScalar("hello", { name: "Alice" });
      expect(result).to.equal("hello Alice");
    });

    it("add returns sum of two numbers", async function () {
      const result = await queryScalar("add", { a: 3, b: 7 });
      expect(result).to.equal(10);
    });

    it("isTrue returns boolean correctly", async function () {
      const trueResult = await queryScalar("isTrue", { value: true });
      expect(trueResult).to.equal(true);

      const falseResult = await queryScalar("isTrue", { value: false });
      expect(falseResult).to.equal(false);
    });

    it("echoBigInt echoes back a bigint value", async function () {
      const result = await queryScalar("echoBigInt", { value: "12345678901234567890" });
      expect(result).to.equal("12345678901234567890");
    });
  });

  describe("nullable and optional arguments", function () {
    it("greetNullable with null returns anonymous", async function () {
      const result = await queryScalar("greetNullable", { name: null });
      expect(result).to.equal("hello anonymous");
    });

    it("greetNullable with a value returns greeting", async function () {
      const result = await queryScalar("greetNullable", { name: "Bob" });
      expect(result).to.equal("hello Bob");
    });

    it("greetOptional with no args returns default", async function () {
      const result = await queryScalar("greetOptional", {});
      expect(result).to.equal("hello default");
    });

    it("greetOptional with a value returns greeting", async function () {
      const result = await queryScalar("greetOptional", { name: "Charlie" });
      expect(result).to.equal("hello Charlie");
    });
  });

  describe("array types", function () {
    it("sumArray returns sum of number array", async function () {
      const result = await queryScalar("sumArray", { numbers: [1, 2, 3, 4, 5] });
      expect(result).to.equal(15);
    });

    it("reverseStrings returns reversed array", async function () {
      const result = await queryScalar("reverseStrings", { items: ["a", "b", "c"] });
      expect(result).to.deep.equal(["c", "b", "a"]);
    });
  });

  describe("object types", function () {
    it("getDistance computes distance between coordinates", async function () {
      const result = await queryScalar("getDistance", {
        from: { lat: 0, lng: 0 },
        to: { lat: 3, lng: 4 },
      });
      expect(result).to.equal(5);
    });

    it("describePlace returns a description string", async function () {
      const result = await queryScalar("describePlace", {
        place: { name: "Office", location: { lat: 40.7, lng: -74.0 } },
      });
      expect(result).to.equal("Office is at (40.7, -74)");
    });
  });

  describe("nested return types", function () {
    it("getPersonWithAddress returns nested object with field selection", async function () {
      const response = await client.postQuery({
        collection: "getPersonWithAddress",
        query: {
          fields: {
            __value: {
              type: "column",
              column: "__value",
              fields: {
                type: "object",
                fields: {
                  name: { type: "column", column: "name" },
                  age: { type: "column", column: "age" },
                  address: {
                    type: "column",
                    column: "address",
                    fields: {
                      type: "object",
                      fields: {
                        street: { type: "column", column: "street" },
                        city: { type: "column", column: "city" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        arguments: {
          name: { type: "literal", value: "Alice" },
          age: { type: "literal", value: 30 },
          street: { type: "literal", value: "123 Main St" },
          city: { type: "literal", value: "Springfield" },
        },
        collection_relationships: {},
      });
      expect(response.status).to.equal(200);
      const body: any = await response.json();
      const value = body[0]?.rows?.[0]?.__value;
      expect(value).to.deep.equal({
        name: "Alice",
        age: 30,
        address: {
          street: "123 Main St",
          city: "Springfield",
        },
      });
    });
  });

  describe("async functions", function () {
    it("asyncGreet returns async greeting", async function () {
      const result = await queryScalar("asyncGreet", { name: "Dave" });
      expect(result).to.equal("async hello Dave");
    });

    it("asyncGetPlace returns async place object", async function () {
      const response = await client.postQuery({
        collection: "asyncGetPlace",
        query: {
          fields: {
            __value: {
              type: "column",
              column: "__value",
              fields: {
                type: "object",
                fields: {
                  name: { type: "column", column: "name" },
                  location: {
                    type: "column",
                    column: "location",
                    fields: {
                      type: "object",
                      fields: {
                        lat: { type: "column", column: "lat" },
                        lng: { type: "column", column: "lng" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        arguments: {
          name: { type: "literal", value: "Park" },
          lat: { type: "literal", value: 51.5 },
          lng: { type: "literal", value: -0.1 },
        },
        collection_relationships: {},
      });
      expect(response.status).to.equal(200);
      const body: any = await response.json();
      const value = body[0]?.rows?.[0]?.__value;
      expect(value).to.deep.equal({
        name: "Park",
        location: { lat: 51.5, lng: -0.1 },
      });
    });
  });

  describe("variables", function () {
    it("executes query with variable arguments for each variable set", async function () {
      const request = makeVariableQueryRequest(
        "hello",
        {},
        { name: "nameVar" },
        [{ nameVar: "Var1" }, { nameVar: "Var2" }]
      );
      const response = await client.postQuery(request);
      expect(response.status).to.equal(200);
      const body: any = await response.json();
      expect(body).to.have.lengthOf(2);
      expect(body[0]?.rows?.[0]?.__value).to.equal("hello Var1");
      expect(body[1]?.rows?.[0]?.__value).to.equal("hello Var2");
    });

    it("mixes literal and variable arguments", async function () {
      const request = makeVariableQueryRequest(
        "add",
        { a: 10 },
        { b: "bVar" },
        [{ bVar: 5 }, { bVar: 20 }]
      );
      const response = await client.postQuery(request);
      expect(response.status).to.equal(200);
      const body: any = await response.json();
      expect(body).to.have.lengthOf(2);
      expect(body[0]?.rows?.[0]?.__value).to.equal(15);
      expect(body[1]?.rows?.[0]?.__value).to.equal(30);
    });
  });
});
