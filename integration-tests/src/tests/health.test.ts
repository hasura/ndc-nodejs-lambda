import { expect } from "chai";
import { client } from "./root-hooks";

describe("Health endpoint", function () {
  it("GET /health returns 200", async function () {
    const response = await client.getHealth();
    expect(response.status).to.equal(200);
  });
});
