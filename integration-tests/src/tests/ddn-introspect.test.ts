import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { ddnProjectDir } from "./root-hooks";

describe("DDN connector introspect", function () {
  it("DataConnectorLink has valid schema after manual introspection", function () {
    // The root-hooks.ts calls updateDataConnectorLinkSchema() which fetches
    // the schema from the running connector and updates the HML file.
    // This test verifies that the schema was properly updated.

    const hmlPath = path.join(ddnProjectDir, "app", "metadata", "myjs.hml");
    const hmlContent = fs.readFileSync(hmlPath, "utf-8");

    // Verify the version was updated from empty string
    expect(hmlContent).to.include('version: "v0.2"');

    // Verify the schema contains actual function definitions
    expect(hmlContent).to.include('"functions"');
    expect(hmlContent).to.include('"procedures"');

    // Verify capabilities were populated
    expect(hmlContent).to.include('"query"');
    expect(hmlContent).to.include('"mutation"');
  });
});
