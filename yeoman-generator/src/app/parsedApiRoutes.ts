import { ParsedRoute } from "swagger-typescript-api"
const CircularJSON = require('circular-json');

export enum ParamType {
  QUERY = 'query',
  PATH = 'path',
}

export type Param = {
  name: string,
  description?: string,
  required: boolean,
  tsType: string,
  format?: string,
  paramType: ParamType,
}

export type ApiRoute = {
  type: string, // get/post etc
  successType: any, // successDto
  errorType: any, // error DTO
  description?: string, // description of the api
  namespace: string, // in Api.ts, the name of the namespace to which this api call belongs
  apiFunction: string, // in Api.ts, the name of the function that calls this api
  queryVariablesContent: string, // all the variables in query, in a printable string format
  queryVariableName: string, // in Api.ts, the name of the function param that accepts the query variables
  functionName: string, // the name of the function that will be generated in function.ts file
  queryParams: Param[], // TODO: remove
  pathParams: Param[], // TODO: remove
  allParams: Param[],
  isQuery: boolean,

  // parsedRoute: ParsedRoute,
}

export class ParsedApiRoutes {
  private apiRoutes: ApiRoute[] = [];
  private importList: Set<string> = new Set<string>(['Api']);

  private reservedTypes = new Set<string>(['void', 'any',
    'string', 'Record', 'number']);

  public parse(route: any) {

    // ensure keywords like `void` are not added to import list and hence to added to import statements
    // if (!this.reservedTypes.has(this.getImportType(route.response.type))) {
    //   this.importList.add(this.getImportType(route.response.type));
    // }
    // if (!this.reservedTypes.has(this.getImportType(route.response.errorType))) {
    //   this.importList.add(this.getImportType(route.response.errorType));
    // }
    this.addTypeToImportList(route.response.type, this.importList);
    this.addTypeToImportList(route.response.errorType, this.importList);

    const allParams = this.parseParams(route.routeParams.query, ParamType.QUERY);
    allParams.push(...this.parseParams(route.routeParams.path, ParamType.PATH));

    this.sortParamsByOptionality(allParams);


    const apiRoute: ApiRoute = {
      type: route.request.method,
      successType: this.sanitizeTypes(route.response.type),
      errorType: this.sanitizeTypes(route.response.errorType),
      description: route.raw.summary,
      namespace: route.namespace,
      apiFunction: route.routeName.usage,
      queryVariablesContent: route.specificArgs?.query?.type,
      queryVariableName: route.specificArgs?.query?.name,
      functionName: this.getFunctionName(route.request.method, route.namespace, route.routeName.usage),
      queryParams: this.parseParams(route.routeParams.query, ParamType.QUERY),
      pathParams: this.parseParams(route.routeParams.path, ParamType.PATH),
      allParams: allParams,

      isQuery: route.raw.method === 'get'

      // parsedRoute: route,
    };
    // if (apiRoute.functionName === 'getStoreGetInventory') {
    //   console.log('\n\n\n\n\nparsedApiRoutes: parse: apiRoute: ', apiRoute);
    //   console.log('parsedApiRoutes: parse: apiRoute (JSON): ', CircularJSON.stringify(apiRoute));
    //   console.log('\n\nparsedApiRoutes: parse: route: ', route);
    //   console.log('parsedApiRoutes: parse: route (JSON): ', CircularJSON.stringify(route));
    // }

    this.apiRoutes.push(apiRoute);
  }

  public getApiRoutes(): ApiRoute[] {
    return this.apiRoutes;
  }

  public getImportList(): string[] {
    return Array.from(this.importList);
  }

  private getImportType(type: string) {
    type = this.sanitizeTypes(type);
    if (type.endsWith('[]')) {
      return type.slice(0, type.length-2);
    } else {
      return type;
    }
  }

  private addTypeToImportList(type: string, importList: Set<string>) {
    const allTypes = this.splitGenericType(type);
    for (type of allTypes) {
      if (!this.reservedTypes.has(this.getImportType(type))) {
        importList.add(this.getImportType(type));
      }
    }
  }

  private splitGenericType(type: string): string[] {
    if (type.includes('<') && type.includes('>')) {
      type = type.replace('<', ',');
      type = type.replace('>', '');
      return type.split(',');
    }
    return [type];
  }

  private sortParamsByOptionality(params: Param[]) { // puts all required params at the start of the array and the optional ones at the end
    let optionalParams: Param[] = [];
    let requiredParams: Param[] = [];
    for (const p of params) {
      if (p.required && p.required === true) {
        requiredParams.push(p);
      } else {
        optionalParams.push(p);
      }
    }
    params.splice(0, params.length);
    params.push(...requiredParams);
    params.push(...optionalParams);
  }

  private sanitizeTypes(type: string): string {
    type = type.replace('(', '');
    type = type.replace(')', '');
    return type;
  }

  private getFunctionName(type: string, namespace: string, apiFunction: string): string {
    return `${type}${this.capitalizeFirstLetter(namespace)}${this.capitalizeFirstLetter(apiFunction)}`
  }

  private capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private parseParams(args: any[], paramType: ParamType): Param[] { // TODO: change parameter name to `routeParametersArray` or something more descriptive
    if (!args || args.length === 0) {
      return [];
    }

    const returnParams: Param[] = [];
    for (const arg of args) {
      const param: Param = {
        name: arg['name'],
        description: arg['description'],
        required: (arg['required'] && arg['required'] === true) ? true : false,
        tsType: this.getTypeMapping(arg),
        format: arg['format'],
        paramType: paramType,
      }

      returnParams.push(param);
    }
    return returnParams;
  }

  private getTypeMapping(routeParam: any): string {
    let tsTypeMapping = new Map<string, string>();
    tsTypeMapping.set('integer', 'number');

    if (routeParam['type'] === 'array') {
      return tsTypeMapping.get(routeParam.schema.items.type)
        ? `${tsTypeMapping.get(routeParam.schema.items.type)}[]`
        : `${routeParam.schema.items.type}[]`;
    }
    return tsTypeMapping.get(routeParam['type']) ? tsTypeMapping.get(routeParam['type']) : routeParam['type'];
  }
}