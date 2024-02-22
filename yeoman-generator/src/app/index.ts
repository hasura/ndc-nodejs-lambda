import Generator from "yeoman-generator";
import pacote from "pacote"
import { version } from "../../package.json"
import { SemVer } from "semver";

export default class extends Generator {
  _targetHasuraDdnVersion?: "alpha" | "beta";

  constructor(args: string | string[], opts: Generator.GeneratorOptions) {
    super(args, opts);
    this.env.options.nodePackageManager = "npm";
  }

  async initializingCheckTemplateIsLatestVersion() {
    const packageManifest = await pacote.manifest("generator-hasura-ndc-nodejs-lambda");
    const latestVersion = new SemVer(packageManifest.version);
    const currentVersion = new SemVer(version);
    if (currentVersion.compare(latestVersion) === -1) {
      const answer = await this.prompt({
        type: "confirm",
        name: "continueWithOutOfDateVersion",
        message: `There's a new version of generator-hasura-ndc-nodejs-lambda (latest: ${latestVersion.version}, current: ${currentVersion.version})!\nConsider upgrading by running 'npm install -g generator-hasura-ndc-nodejs-lambda'.\nWould you like to continue anyway?`,
        default: true,
      });
      if (answer.continueWithOutOfDateVersion === false) {
        this.log.error("Cancelled");
        process.exit(1);
      }
    }

  }

  async initializingCheckAlphaBetaTarget() {
    const answer = await this.prompt({
      type: "list",
      name: "hasuraDdnVersion",
      message: "Which version of the Hasura DDN are you targeting?",
      choices: [
        {
          name: "Hasura DDN Alpha",
          value: "alpha",
        },
        {
          name: "Hasura DDN Beta",
          value: "beta",
        }
      ]
    });
    this._targetHasuraDdnVersion = answer.hasuraDdnVersion;
  }

  writingTemplateFiles() {
    this.fs.copyTpl(
      this.templatePath("functions.ts"),
      this.destinationPath("functions.ts")
    );
    if (this._targetHasuraDdnVersion === "alpha") {
      this.fs.copyTpl(
        this.templatePath("configuration.json"),
        this.destinationPath("configuration.json")
      );
    }
    this.fs.copyTpl(
      this.templatePath("tsconfig.json"),
      this.destinationPath("tsconfig.json")
    );
  }

  async installSdkPackage() {
    const versionRangeRestrictions = {
      alpha: "@0.x", // Latest 0.x version
      beta: "", // Latest version
    }
    const versionRestriction = this._targetHasuraDdnVersion
      ? versionRangeRestrictions[this._targetHasuraDdnVersion]
      : ""

    const configuration = this._targetHasuraDdnVersion === "alpha"
      ? "configuration.json"
      : "./";

    const packageManifest = await pacote.manifest(`@hasura/ndc-lambda-sdk${versionRestriction}`, {  });
    this.packageJson.merge({
      "private": true,
      "engines": {
        "node": ">=18"
      },
      "scripts": {
        "start": `ndc-lambda-sdk host -f functions.ts serve --configuration ${configuration}`,
        "watch": `ndc-lambda-sdk host -f functions.ts --watch serve --configuration ${configuration} --pretty-print-logs`
      },
      "dependencies": {
        "@hasura/ndc-lambda-sdk": packageManifest.version
      }
    })
  }
}
