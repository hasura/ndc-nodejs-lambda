import Generator from "yeoman-generator";
import pacote from "pacote"

export default class extends Generator {
  constructor(args: string | string[], opts: Generator.GeneratorOptions) {
    super(args, opts);
    this.env.options.nodePackageManager = "npm";
  }

  writingTemplateFiles() {
    this.fs.copyTpl(
      this.templatePath("functions.ts"),
      this.destinationPath("functions.ts")
    );
    this.fs.copyTpl(
      this.templatePath("configuration.json"),
      this.destinationPath("configuration.json")
    );
  }

  async installSdkPackage() {
    const packageManifest = await pacote.manifest("@hasura/ndc-lambda-sdk");
    this.packageJson.merge({
      "private": true,
      "scripts": {
        "start": "ndc-lambda-sdk host -f functions.ts serve --configuration configuration.json",
        "watch": "ndc-lambda-sdk host -f functions.ts --watch serve --configuration configuration.json"
      },
      "dependencies": {
        "@hasura/ndc-lambda-sdk": packageManifest.version
      }
    })
  }
}
