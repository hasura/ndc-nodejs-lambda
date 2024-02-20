import Generator from "yeoman-generator";
import pacote from "pacote"
import { version } from "../../package.json"
import { SemVer } from "semver";
import { ParsedRoute, generateApi } from "swagger-typescript-api";
import * as path from 'path';
import { inspect } from 'util'
import { Eta } from 'eta';

const CircularJSON = require('circular-json');

export default class extends Generator {
  oasRouteData: ParsedRoute[] = [];

  constructor(args: string | string[], opts: Generator.GeneratorOptions) {
    super(args, opts);
    console.log('*************** Running updated yeoman gen ****************');
    this.env.options.nodePackageManager = "npm";
    this.option("openapi", { type: String, default: '' });
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

    const templateDir = path.resolve(__dirname, '../../templates/custom');
    console.log('yeoman-generator: index.ts: templateDir: ', templateDir);
    const openapi = this.options['openapi'];
    if(openapi !== ''){
      const isUrl = /^https?:/.test(openapi)
      this.log.info("Generating API class from OpenAPI file...")
      await generateApi({
        name: "Api.ts",
        url: isUrl ? openapi : null,
        input: !isUrl ? openapi : null,
        output: path.resolve(process.cwd()),
        templates: templateDir,
        hooks: {
          onCreateComponent: (component) => {
            // console.log('onCreateComponent: component', component);
          },
          onCreateRequestParams: (rawType) => {
            // console.log('onCreateRequestParams: rawType: ', rawType);
          },
          onCreateRoute: (routeData) => {
            this.oasRouteData.push(routeData);
            console.log('onCreateRoute: routeData: ', routeData);
            console.log('onCreateRoute: routeData (JSON): ', CircularJSON.stringify(routeData));
          },
          onCreateRouteName: (routeNameInfo, rawRouteInfo) => {},
          onFormatRouteName: (routeInfo, templateRouteName) => {},
          onFormatTypeName: (typeName, rawTypeName, schemaType) => {},
          onInit: (configuration) => {},
          onPreParseSchema: (originalSchema, typeName, schemaType) => {},
          onParseSchema: (originalSchema, parsedSchema) => {},
          onPrepareConfig: (currentConfiguration) => {},
        }
      })
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
    this.fillFunctionTsFile();
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

  fillFunctionTsFile() {
    // WARNING:
    // HIGHLY EXPERIMENTAL, PLEADE *DO NOT* PUSH TO PRODUCTION

    const functionTsFilePath = path.resolve(process.cwd(), "functions.ts");

    const getRequests: ParsedRoute[] = [];
    for (let parsedRoute of this.oasRouteData) {
      if (parsedRoute.raw.method === 'get') {
        getRequests.push(parsedRoute);
      }
    };

    // for (let req of getRequests) {
    //   const functionName = `get${this.capitalizeFirstLetter(req.namespace)}${this.capitalizeFirstLetter(req.routeName.original)}`;
    // }


    const eta = new Eta({ views: path.join(__dirname, '../../templates/functions') })
    const res = eta.render("functions.ejs", { getRequests: getRequests });

    this.fs.write(functionTsFilePath, res);
  }

  // capitalizeFirstLetter(str: string): string {
  //   return str.charAt(0).toUpperCase() + str.slice(1);
  // }
}
