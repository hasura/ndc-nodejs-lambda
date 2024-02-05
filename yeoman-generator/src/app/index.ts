import Generator from "yeoman-generator";
import pacote from "pacote"
import { version } from "../../package.json"
import { SemVer } from "semver";
// import * as fs from "fs";
import OpenAPIParser from "@readme/openapi-parser";
import OpenAPI from "openapi-types";

// TODO: Helper functions. Move these somewhere more organised.

// async function readFileAsync(url: string): Promise<string> {
//   return new Promise((resolve, reject) => {
//     fs.readFile(url, "utf8", (err,data) => {
//       if(err) {
//         reject(err);
//       } else {
//         resolve(data);
//       }
//     });
//   });
// }

// async function fetchAnything(url: string, log: any): Promise<string> {
//   let parsed;
//   try {
//     parsed = new URL(url);
//   } catch(e) {
//     log.info(`Couldn't parse openapi url (${url}), assuming that it is a local file.`);
//     return await readFileAsync(url);
//   }
//   switch(parsed.protocol) {
//     case 'file:':
//       return await readFileAsync(parsed.pathname);
//     case 'http:':
//     case 'https:':
//       const response = await fetch(url);
//       return await response.text();
//     default:
//       throw new Error(`Unsupported protocol (${parsed.protocol}) for url ${url}`);
//   }
// }

async function parseOpenAPI(definition: string): Promise<OpenAPI.OpenAPI.Document<{}>> {
  return new Promise((resolve, reject) => {
    OpenAPIParser.validate(definition, (err, api) => {
      if (err) {
        reject(err);
      }
      else if(api) {
        resolve(api);
      }
      else {
        reject(new Error('API error during parsing.'));
      }
    });
  });
}

export default class extends Generator {
  constructor(args: string | string[], opts: Generator.GeneratorOptions) {
    super(args, opts);
    this.env.options.nodePackageManager = "npm";
    this.option("openapi", { type: String, default: false });
  }

  async initializingCheckTemplateIsLatestVersion() {
    const packageManifest = await pacote.manifest("generator-hasura-ndc-nodejs-lambda");
    const latestVersion = new SemVer(packageManifest.version);
    const currentVersion = new SemVer(version);

    const openapi = this.options['openapi'];
    if(openapi) {
      this.log.info(`LOLOLOLOLOL: ${openapi}`);
      // const definition = await fetchAnything(openapi, this.log);
      // this.log.info(definition);
      const api = await parseOpenAPI(openapi);
      this.log.info(api);
    }

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

  writingTemplateFiles() {
    this.fs.copyTpl(
      this.templatePath("functions.ts"),
      this.destinationPath("functions.ts")
    );
    this.fs.copyTpl(
      this.templatePath("configuration.json"),
      this.destinationPath("configuration.json")
    );
    this.fs.copyTpl(
      this.templatePath("tsconfig.json"),
      this.destinationPath("tsconfig.json")
    );
  }

  async installSdkPackage() {
    const packageManifest = await pacote.manifest("@hasura/ndc-lambda-sdk");
    this.packageJson.merge({
      "private": true,
      "engines": {
        "node": ">=18"
      },
      "scripts": {
        "start": "ndc-lambda-sdk host -f functions.ts serve --configuration configuration.json",
        "watch": "ndc-lambda-sdk host -f functions.ts --watch serve --configuration configuration.json --pretty-print-logs"
      },
      "dependencies": {
        "@hasura/ndc-lambda-sdk": packageManifest.version
      }
    })
  }
}
