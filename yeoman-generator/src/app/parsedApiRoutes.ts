import { ParsedRoute } from "swagger-typescript-api"

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

  parsedRoute: ParsedRoute,
}

export class ParsedApiRoutes {
  private apiRoutes: ApiRoute[] = [];
  private importList: string[] = ['Api'];

  public parse(route: any) {
    this.importList.push(this.getImportType(route.response.type));
    this.importList.push(this.getImportType(route.response.errorType));
    const apiRoute: ApiRoute = {
      type: route.request.method,
      successType: this.sanitizeTypes(route.response.type),
      errorType: this.sanitizeTypes(route.response.errorType),
      description: route.raw.summary,
      namespace: route.namespace,
      apiFunction: route.routeName.usage,
      queryVariablesContent: route.specificArgs.query.type,
      queryVariableName: route.specificArgs.query.name,
      functionName: this.getFunctionName(route.request.method, route.namespace, route.routeName.usage),

      parsedRoute: route,
    };
    // console.log('parsedApiRoutes: parse: apiRoute: ', apiRoute);
    this.apiRoutes.push(apiRoute);
  }

  public getApiRoutes(): ApiRoute[] {
    return this.apiRoutes;
  }

  public getImportList(): string[] {
    return this.importList;
  }

  private getImportType(type: string) {
    type = this.sanitizeTypes(type);
    if (type.endsWith('[]')) {
      return type.slice(0, type.length-2);
    } else {
      return type;
    }
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
}
