import Generator from "yeoman-generator";
import pacote from "pacote"
import { version } from "../../package.json"
import { SemVer } from "semver";
import { ParsedRoute, generateApi } from "swagger-typescript-api";
import * as path from 'path';
import { inspect } from 'util'
import { Eta } from 'eta';
import { ApiRoute, ParsedApiRoutes } from "./open-api-generator/parsedApiRoutes";
import { writeFileSync } from "fs";
import { generateCode } from "./open-api-generator";

const CircularJSON = require('circular-json');


export default class extends Generator {
  _targetHasuraDdnVersion?: "alpha" | "beta";
  oasRouteData: ParsedRoute[] = [];
  generatedComponents = new Set<string>();
  baseUrl: string = '';

  constructor(args: string | string[], opts: Generator.GeneratorOptions) {
    super(args, opts);
    this.env.options.nodePackageManager = "npm";
    this.option("open-api", { type: String, default: '' });
    this.option("base-url", { type: String, default: ''});
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
    const openapi = this.options['open-api'];
    this.baseUrl = this.options['base-url'];
    if(openapi !== ''){
      const isUrl = /^https?:/.test(openapi)
      this.log.info("Generating API class from OpenAPI file...")
      const functionFileStr = await generateCode(openapi, path.resolve(process.cwd()));
      // await generateApi({
      //   name: "Api.ts",
      //   url: isUrl ? openapi : null,
      //   input: !isUrl ? openapi : null,
      //   output: path.resolve(process.cwd()),
      //   templates: templateDir,
      //   hooks: {
      //     onCreateComponent: (component) => {
      //       /**
      //        * Contains the full definition of the type, along with individual variables in objects
      //        */
      //       // console.log('\n\n\n\n\n onCreateComponent: component', component);
      //       // console.log('onCreateComponent: component(JSON): ', CircularJSON.stringify(component));
      //       // this.generatedComponents.add(component.typeName);
      //     },
      //     onCreateRequestParams: (rawType) => {
      //       // console.log('\n\n\n\n onCreateRequestParams: rawType', rawType);
      //       // console.log('onCreateRequestParams: rawType(JSON): ', CircularJSON.stringify(rawType));
      //     },
      //     onCreateRoute: (routeData) => {
      //       this.oasRouteData.push(routeData);
      //       console.log('onCreateRoute: routeData: ');
      //       // console.log('\n\n\n\n\n onCreateRoute: routeData: ', routeData);
      //       // console.log('onCreateRoute: routeData (JSON): ', CircularJSON.stringify(routeData));
      //       // console.log('\nonCreateRoute: routeData Type: ', (typeof routeData));
      //     },
      //     onCreateRouteName: (routeNameInfo, rawRouteInfo) => {
      //       // console.log('\n\n\n\n\n onCreateRouteName: routeNameInfo', routeNameInfo);
      //       // console.log('onCreateRouteName: routeNameInfo(JSON): ', CircularJSON.stringify(routeNameInfo));
      //       // console.log('\n onCreateRouteName: rawRouteInfo', rawRouteInfo);
      //       // console.log('onCreateRouteName: rawRouteInfo(JSON): ', CircularJSON.stringify(rawRouteInfo));
      //     },
      //     onFormatRouteName: (routeInfo, templateRouteName) => {

      //     },
      //     onFormatTypeName: (typeName, rawTypeName, schemaType) => {
      //       /**
      //        * typename is the name of the type generated for typescript. eg. MainBlog
      //        * rawTypeName is equal to the component.typename from onCreateComponent hook.
      //        */
      //       // console.log('\n\n onFormatTypeName: typeName: ', typeName);
      //       // console.log('onFormatTypeName: typeName (JSON): ', CircularJSON.stringify(typeName));
      //       // console.log('\n\n FormatTypeName: rawTypeName: ', rawTypeName);
      //       // console.log('onFormatTypeName: rawTypeName (JSON): ', CircularJSON.stringify(rawTypeName));
      //       // console.log('\n\n FormatTypeName: schemaType: ', schemaType);
      //       // console.log('onFormatTypeName: schemaType (JSON): ', CircularJSON.stringify(schemaType));
      //       this.generatedComponents.add(typeName);
      //     },
      //     onInit: (configuration) => {
      //       // console.log('\n\n\n\n\n onInit: configuration: ', configuration);
      //       // console.log('onInit: configuration (JSON): ', CircularJSON.stringify(configuration));
      //     },
      //     onPreParseSchema: (originalSchema, typeName, schemaType) => {

      //     },
      //     onParseSchema: (originalSchema, parsedSchema) => {
      //       // console.log('\n\n\n\n\n onParseSchema: originalSchema: ', originalSchema);
      //       // console.log('onParseSchema: originalSchema (JSON): ', CircularJSON.stringify(originalSchema));
      //       // console.log('\n\n\n onParseSchema: parsedSchema: ', parsedSchema);
      //       // console.log('ononParseSchemaInit: parsedSchema (JSON): ', CircularJSON.stringify(parsedSchema));
      //     },
      //     onPrepareConfig: (currentConfiguration) => {},
      //   }
      // })
      this.fillFunctionTsFile(functionFileStr);
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
    console.log('writingTemplateFiles() called')
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
    // this.fillFunctionTsFile();
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

  fillFunctionTsFile(fileContents: string) {
    // WARNING:
    // HIGHLY EXPERIMENTAL, PLEADE *DO NOT* PUSH TO PRODUCTION

    // console.log('fillFunctionTsFile called()');

    const functionTsFilePath = path.resolve(process.cwd(), "functions.ts");


    // const parsedApiRoutesObj = new ParsedApiRoutes(this.generatedComponents);

    // const getRequests: ParsedRoute[] = [];
    // for (let parsedRoute of this.oasRouteData) {
    //   // const getRequests: ParsedRoute[] = [];
    //   // const parsedApiRoutesObj = new ParsedApiRoutes();
    //   getRequests.push(parsedRoute);
    //   parsedApiRoutesObj.parse(parsedRoute);
    // };

    // // for (let req of getRequests) {
    // //   const functionName = `get${this.capitalizeFirstLetter(req.namespace)}${this.capitalizeFirstLetter(req.routeName.original)}`;
    // // }


    // const eta = new Eta({ views: path.join(__dirname, '../../templates/functions') })
    // const res = eta.render("functions.ejs", { apiRoutes: parsedApiRoutesObj.getApiRoutes(), importList: parsedApiRoutesObj.getImportList(), baseUrl: this.baseUrl });

    // console.log('fillFunctionTsFiile: fileContents: ', fileContents);

    this.fs.write(functionTsFilePath, `${fileContents}`);
  }

  // private generateFile(fileName: string, apiRoutes: ApiRoute[], importList: string[]) {
  //   const functionTsFilePath = path.resolve(process.cwd(), fileName);

  //   const eta = new Eta({ views: path.join(__dirname, '../../templates/functions'), autoEscape: false }); // autoEscape: false prevents special chars like " from being converted to &quot
  //   const res = eta.render("functions.ejs", { apiRoutes: apiRoutes, importList: importList });

  //   console.log('index.ts: generateFile: fileContents: ', res);
  //   writeFileSync(functionTsFilePath, res);
  //   // this.fs.write(functionTsFilePath, res);
  //   console.log('index.ts: generateFile: File generated: ', fileName);
  // }

  // capitalizeFirstLetter(str: string): string {
  //   return str.charAt(0).toUpperCase() + str.slice(1);
  // }
}
