import { ParsedRoute, generateApi, Hooks, SchemaComponent } from "swagger-typescript-api";
import * as path from 'path';

const CircularJSON = require('circular-json');

const templateDir = path.resolve(__dirname, '../../templates/custom')

export class ApiComponents {
  rawTypeToTypeMap: Map<string, string>;
  typeToRawTypeMap: Map<string, string>;
  components: SchemaComponent[];
  routes: ParsedRoute[];

  constructor() {
    this.rawTypeToTypeMap = new Map<string, string>();
    this.typeToRawTypeMap = new Map<string, string>();
    this.components = [];
    this.routes = [];
  }

  public addComponent(component: SchemaComponent) {
    this.components.push(component);
  }

  public addTypes(rawType: string, type: string) {
    this.rawTypeToTypeMap.set(rawType, type);
    this.typeToRawTypeMap.set(type, rawType);
  }

  public addRoute(route: ParsedRoute) {
    this.routes.push(route);
  }

  public getTypeNames(): IterableIterator<string> {
    return this.typeToRawTypeMap.keys();
  }

  public getRoutes(): ParsedRoute[] {
    return this.routes;
  }
}

export async function generateOpenApiTypescriptFile(
  filename: string,
  url: string | undefined,
  filePath: string | undefined,
  outputDir: string,
  hooks: Hooks | undefined,
): Promise<ApiComponents> {
  const apiComponents = new ApiComponents();

  await generateApi({
    name: filename,
    url: url ? url : "",
    input: filePath,
    output: outputDir,
    templates: templateDir,
    hooks: {
      onCreateComponent: (component) => {
        /**
         * Contains the full definition of the type, along with individual variables in objects
         */
        console.log('\n\n\n\n\n onCreateComponent: component', component);
        console.log('onCreateComponent: component(JSON): ', CircularJSON.stringify(component));

        apiComponents.addComponent(component);
      },
      onCreateRequestParams: (rawType) => {
        // console.log('\n\n\n\n onCreateRequestParams: rawType', rawType);
        // console.log('onCreateRequestParams: rawType(JSON): ', CircularJSON.stringify(rawType));
      },
      onCreateRoute: (routeData) => {
        // this.oasRouteData.push(routeData);
        console.log('onCreateRoute: routeData: ');
        // console.log('\n\n\n\n\n onCreateRoute: routeData: ', routeData);
        // console.log('onCreateRoute: routeData (JSON): ', CircularJSON.stringify(routeData));
        // console.log('\nonCreateRoute: routeData Type: ', (typeof routeData));

        apiComponents.addRoute(routeData);
      },
      onCreateRouteName: (routeNameInfo, rawRouteInfo) => {
        // console.log('\n\n\n\n\n onCreateRouteName: routeNameInfo', routeNameInfo);
        // console.log('onCreateRouteName: routeNameInfo(JSON): ', CircularJSON.stringify(routeNameInfo));
        // console.log('\n onCreateRouteName: rawRouteInfo', rawRouteInfo);
        // console.log('onCreateRouteName: rawRouteInfo(JSON): ', CircularJSON.stringify(rawRouteInfo));
      },
      onFormatRouteName: (routeInfo, templateRouteName) => {

      },
      onFormatTypeName: (typeName, rawTypeName, schemaType) => {
        /**
         * typename is the name of the type generated for typescript. eg. MainBlog
         * rawTypeName is equal to the component.typename from onCreateComponent hook.
         */
        apiComponents.addTypes(rawTypeName ? rawTypeName : typeName, typeName);
        // console.log('\n\n onFormatTypeName: typeName: ', typeName);
        // console.log('onFormatTypeName: typeName (JSON): ', CircularJSON.stringify(typeName));
        // console.log('\n\n FormatTypeName: rawTypeName: ', rawTypeName);
        // console.log('onFormatTypeName: rawTypeName (JSON): ', CircularJSON.stringify(rawTypeName));
        // console.log('\n\n FormatTypeName: schemaType: ', schemaType);
        // console.log('onFormatTypeName: schemaType (JSON): ', CircularJSON.stringify(schemaType));
        // this.generatedComponents.add(typeName);
      },
      onInit: (configuration) => {
        // console.log('\n\n\n\n\n onInit: configuration: ', configuration);
        // console.log('onInit: configuration (JSON): ', CircularJSON.stringify(configuration));
      },
      onPreParseSchema: (originalSchema, typeName, schemaType) => {

      },
      onParseSchema: (originalSchema, parsedSchema) => {
        // console.log('\n\n\n\n\n onParseSchema: originalSchema: ', originalSchema);
        // console.log('onParseSchema: originalSchema (JSON): ', CircularJSON.stringify(originalSchema));
        // console.log('\n\n\n onParseSchema: parsedSchema: ', parsedSchema);
        // console.log('ononParseSchemaInit: parsedSchema (JSON): ', CircularJSON.stringify(parsedSchema));
      },
      onPrepareConfig: (currentConfiguration) => {},
    },
  })

  return apiComponents;
}
