import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { ddnProjectDir } from "./root-hooks";
import { supergraphBuildLocal } from "../helpers/ddn-project";

describe("DDN supergraph build", function () {
  it("successfully builds the supergraph locally", function () {
    this.timeout(60000);

    const supergraphPath = path.join(ddnProjectDir, "supergraph.yaml");

    // Should not throw
    const output = supergraphBuildLocal({ supergraphPath });
    expect(output).to.be.a("string");
  });

  it("produces build artifacts", function () {
    const engineBuildDir = path.join(ddnProjectDir, "engine", "build");
    expect(fs.existsSync(engineBuildDir)).to.be.true;

    // Check for at least one build output file
    const files = fs.readdirSync(engineBuildDir);
    expect(files.length).to.be.greaterThan(0);
  });
});
