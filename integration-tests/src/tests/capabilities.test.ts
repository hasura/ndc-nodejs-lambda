import { expect } from "chai";
import { client } from "./root-hooks";

describe("Capabilities endpoint", function () {
  it("GET /capabilities returns query and mutation capabilities", async function () {
    const response = await client.getCapabilities();
    expect(response.status).to.equal(200);

    const body: any = await response.json();
    expect(body).to.have.property("version");
    expect(body).to.have.property("capabilities");
    expect(body.capabilities).to.have.property("query");
    expect(body.capabilities).to.have.property("mutation");
  });
});
