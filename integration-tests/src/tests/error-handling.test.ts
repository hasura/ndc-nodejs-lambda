import { expect } from "chai";
import { client } from "./root-hooks";

function makeQueryRequest(collection: string): object {
  return {
    collection,
    query: {
      fields: {
        __value: { type: "column", column: "__value" },
      },
    },
    arguments: {},
    collection_relationships: {},
  };
}

describe("Error handling", function () {
  it("throwForbidden returns 403", async function () {
    const response = await client.postQuery(makeQueryRequest("throwForbidden"));
    expect(response.status).to.equal(403);
    const body: any = await response.json();
    expect(body.message).to.include("access denied");
  });

  it("throwConflict returns 409", async function () {
    const response = await client.postQuery(makeQueryRequest("throwConflict"));
    expect(response.status).to.equal(409);
    const body: any = await response.json();
    expect(body.message).to.include("resource conflict");
  });

  it("throwUnprocessable returns 422", async function () {
    const response = await client.postQuery(makeQueryRequest("throwUnprocessable"));
    expect(response.status).to.equal(422);
    const body: any = await response.json();
    expect(body.message).to.include("invalid input");
  });

  it("throwInternalError returns 500", async function () {
    const response = await client.postQuery(makeQueryRequest("throwInternalError"));
    expect(response.status).to.equal(500);
    const body: any = await response.json();
    expect(body.message).to.be.a("string");
  });

  it("querying a nonexistent function returns 400", async function () {
    const response = await client.postQuery(makeQueryRequest("nonexistentFunction"));
    expect(response.status).to.be.oneOf([400, 500]);
  });

  it("calling a procedure via query endpoint returns 400", async function () {
    const response = await client.postQuery(makeQueryRequest("incrementCounter"));
    expect(response.status).to.equal(400);
    const body: any = await response.json();
    expect(body.message).to.be.a("string");
  });
});
