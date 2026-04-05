import { expect } from "chai";
import { client } from "./root-hooks";

describe("Schema endpoint", function () {
  let schema: any;

  before(async function () {
    const response = await client.getSchema();
    expect(response.status).to.equal(200);
    schema = await response.json();
  });

  it("returns functions and procedures", function () {
    expect(schema).to.have.property("functions").that.is.an("array");
    expect(schema).to.have.property("procedures").that.is.an("array");
  });

  it("contains scalar type definitions", function () {
    expect(schema).to.have.property("scalar_types");
    const scalarNames = Object.keys(schema.scalar_types);
    expect(scalarNames).to.include("String");
    expect(scalarNames).to.include("Float");
    expect(scalarNames).to.include("Boolean");
    expect(scalarNames).to.include("BigInt");
  });

  it("contains object type definitions", function () {
    expect(schema).to.have.property("object_types");
    const objectNames = Object.keys(schema.object_types);
    expect(objectNames).to.include("Coordinates");
    expect(objectNames).to.include("Place");
  });

  describe("functions (queries)", function () {
    it("includes hello function", function () {
      const fn = schema.functions.find((f: any) => f.name === "hello");
      expect(fn).to.exist;
      expect(fn.result_type).to.deep.include({ type: "named", name: "String" });
    });

    it("includes add function", function () {
      const fn = schema.functions.find((f: any) => f.name === "add");
      expect(fn).to.exist;
      // arguments is an object, not an array
      expect(Object.keys(fn.arguments)).to.have.lengthOf(2);
      expect(fn.arguments).to.have.property("a");
      expect(fn.arguments).to.have.property("b");
    });

    it("includes isTrue function", function () {
      const fn = schema.functions.find((f: any) => f.name === "isTrue");
      expect(fn).to.exist;
    });

    it("includes echoBigInt function", function () {
      const fn = schema.functions.find((f: any) => f.name === "echoBigInt");
      expect(fn).to.exist;
    });

    it("includes nullable and optional argument functions", function () {
      const greetNullable = schema.functions.find((f: any) => f.name === "greetNullable");
      expect(greetNullable).to.exist;

      const greetOptional = schema.functions.find((f: any) => f.name === "greetOptional");
      expect(greetOptional).to.exist;
    });

    it("includes object-arg functions", function () {
      const getDistance = schema.functions.find((f: any) => f.name === "getDistance");
      expect(getDistance).to.exist;

      const describePlace = schema.functions.find((f: any) => f.name === "describePlace");
      expect(describePlace).to.exist;
    });

    it("includes array functions", function () {
      const sumArray = schema.functions.find((f: any) => f.name === "sumArray");
      expect(sumArray).to.exist;

      const reverseStrings = schema.functions.find((f: any) => f.name === "reverseStrings");
      expect(reverseStrings).to.exist;
    });

    it("includes async functions", function () {
      const asyncGreet = schema.functions.find((f: any) => f.name === "asyncGreet");
      expect(asyncGreet).to.exist;

      const asyncGetPlace = schema.functions.find((f: any) => f.name === "asyncGetPlace");
      expect(asyncGetPlace).to.exist;
    });

    it("includes error-throwing functions", function () {
      expect(schema.functions.find((f: any) => f.name === "throwForbidden")).to.exist;
      expect(schema.functions.find((f: any) => f.name === "throwConflict")).to.exist;
      expect(schema.functions.find((f: any) => f.name === "throwUnprocessable")).to.exist;
      expect(schema.functions.find((f: any) => f.name === "throwInternalError")).to.exist;
    });
  });

  describe("procedures (mutations)", function () {
    it("includes incrementCounter", function () {
      const proc = schema.procedures.find((p: any) => p.name === "incrementCounter");
      expect(proc).to.exist;
    });

    it("includes resetCounter", function () {
      const proc = schema.procedures.find((p: any) => p.name === "resetCounter");
      expect(proc).to.exist;
    });

    it("includes createUser", function () {
      const proc = schema.procedures.find((p: any) => p.name === "createUser");
      expect(proc).to.exist;
      // arguments is an object, not an array
      expect(Object.keys(proc.arguments)).to.have.lengthOf(2);
      expect(proc.arguments).to.have.property("name");
      expect(proc.arguments).to.have.property("email");
    });

    it("includes asyncCreateItem", function () {
      const proc = schema.procedures.find((p: any) => p.name === "asyncCreateItem");
      expect(proc).to.exist;
    });
  });
});
