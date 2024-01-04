import * as sdk from "@hasura/ndc-sdk-typescript"
import * as schema from "./schema"
import { isArray, mapObjectValues, unreachable } from "./util"

export type RuntimeFunctions = {
  [functionName: string]: Function
}

export async function executeQuery(queryRequest: sdk.QueryRequest, functionsSchema: schema.FunctionsSchema, runtimeFunctions: RuntimeFunctions): Promise<sdk.QueryResponse> {
  const functionName = queryRequest.collection;

  const functionDefinition = functionsSchema.functions[functionName];
  if (functionDefinition === undefined)
    throw new sdk.BadRequest(`Couldn't find function '${functionName}' in schema.`)
  if (functionDefinition.ndcKind !== schema.FunctionNdcKind.Function) {
    throw new sdk.BadRequest(`'${functionName}' is a '${functionDefinition.ndcKind}' and cannot be queried as a ${schema.FunctionNdcKind.Function}.`)
  }

  const runtimeFunction = runtimeFunctions[functionName];
  if (runtimeFunction === undefined)
    throw new sdk.InternalServerError(`Couldn't find '${functionName}' function exported from hosted functions module.`)

  const functionInvocationPreparedArgs = (queryRequest.variables ?? [{}]).map(variables => {
    const resolvedArgs = resolveArgumentValues(queryRequest.arguments, variables)
    return prepareArguments(resolvedArgs, functionDefinition, functionsSchema.objectTypes);
  });

  const rows: Record<string, unknown>[] = [];
  for (const invocationPreparedArgs of functionInvocationPreparedArgs) {
    const result = await invokeFunction(runtimeFunction, invocationPreparedArgs, functionName);
    const prunedResult = pruneFields(result, queryRequest.query.fields, functionName);
    rows.push({
      __value: prunedResult
    });
  }

  return [{
    aggregates: {},
    rows
  }];
}

export async function executeMutation(mutationRequest: sdk.MutationRequest, functionsSchema: schema.FunctionsSchema, runtimeFunctions: RuntimeFunctions): Promise<sdk.MutationResponse> {
  const operationResults: sdk.MutationOperationResults[] = [];

  for (const mutationOperation of mutationRequest.operations) {
    const result = await executeMutationOperation(mutationOperation, functionsSchema, runtimeFunctions);
    operationResults.push(result);
  }

  return {
    operation_results: operationResults
  };
}

async function executeMutationOperation(mutationOperation: sdk.MutationOperation, functionsSchema: schema.FunctionsSchema, runtimeFunctions: RuntimeFunctions): Promise<sdk.MutationOperationResults> {
  const functionName = mutationOperation.name;

  const functionDefinition = functionsSchema.functions[functionName];
  if (functionDefinition === undefined)
    throw new sdk.BadRequest(`Couldn't find procedure '${functionName}' in schema.`)
  if (functionDefinition.ndcKind !== schema.FunctionNdcKind.Procedure) {
    throw new sdk.BadRequest(`'${functionName}' is a '${functionDefinition.ndcKind}' and cannot be queried as a ${schema.FunctionNdcKind.Procedure}.`)
  }

  const runtimeFunction = runtimeFunctions[functionName];
  if (runtimeFunction === undefined)
    throw new sdk.InternalServerError(`Couldn't find ${functionName} function exported from hosted functions module.`)

  const preparedArgs = prepareArguments(mutationOperation.arguments, functionDefinition, functionsSchema.objectTypes);
  const result = await invokeFunction(runtimeFunction, preparedArgs, functionName);
  const prunedResult = pruneFields(result, mutationOperation.fields, functionName);

  return {
    affected_rows: 1,
    returning: [{
      __value: prunedResult
    }]
  }
}

function resolveArgumentValues(args: Record<string, sdk.Argument>, variableValues: Record<string, unknown>): Record<string, unknown> {
  return mapObjectValues(args, (argument, argumentName) => {
    switch (argument.type) {
      case "literal":
        return argument.value;
      case "variable":
        if (!(argument.name in variableValues))
          throw new sdk.BadRequest(`Expected value for variable '${argument.name}' not provided for argument ${argumentName}.`);

        return variableValues[argument.name];
      default:
        return unreachable(argument["type"]);
    }
  });
}

export function prepareArguments(args: Record<string, unknown>, functionDefinition: schema.FunctionDefinition, objectTypes: schema.ObjectTypeDefinitions): unknown[] {
  return functionDefinition.arguments.map(argDef => coerceArgumentValue(args[argDef.argumentName], argDef.type, [argDef.argumentName], objectTypes));
}

function coerceArgumentValue(value: unknown, type: schema.TypeDefinition, valuePath: string[], objectTypeDefinitions: schema.ObjectTypeDefinitions): unknown {
  switch (type.type) {
    case "array":
      if (!isArray(value))
        throw new sdk.BadRequest(`Unexpected value in function arguments. Expected an array at '${valuePath.join(".")}'.`);
      return value.map((element, index) => coerceArgumentValue(element, type.elementType, [...valuePath, `[${index}]`], objectTypeDefinitions))

    case "nullable":
      if (value === null) {
        return type.nullOrUndefinability == schema.NullOrUndefinability.AcceptsUndefinedOnly
          ? undefined
          : null;
      } else if (value === undefined) {
        return type.nullOrUndefinability == schema.NullOrUndefinability.AcceptsNullOnly
          ? null
          : undefined;
      } else {
        return coerceArgumentValue(value, type.underlyingType, valuePath, objectTypeDefinitions)
      }
    case "named":
      if (type.kind === "scalar") {
        // Scalars are currently treated as opaque values, which is a bit dodgy
        return value;
      } else {
        const objectTypeDefinition = objectTypeDefinitions[type.name];
        if (!objectTypeDefinition)
          throw new sdk.InternalServerError(`Couldn't find object type '${type.name}' in the schema`);
        if (value === null || typeof value !== "object") {
          throw new sdk.BadRequest(`Unexpected value in function arguments. Expected an object at '${valuePath.join(".")}'.`);
        }
        return Object.fromEntries(objectTypeDefinition.properties.map(propDef => {
          const propValue = (value as Record<string, unknown>)[propDef.propertyName];
          return [propDef.propertyName, coerceArgumentValue(propValue, propDef.type, [...valuePath, propDef.propertyName], objectTypeDefinitions)]
        }));
      }
    default:
      return unreachable(type["type"]);
  }
}

async function invokeFunction(func: Function, preparedArgs: unknown[], functionName: string): Promise<unknown> {
  try {
    const result = func.apply(undefined, preparedArgs);
    // Await the result if it is a promise
    if (typeof result === "object" && 'then' in result && typeof result.then === "function") {
      return await result;
    }
    return result;
  } catch (e) {
    if (e instanceof Error) {
      throw new sdk.InternalServerError(`Error encountered when invoking function '${functionName}'`, { message: e.message, stack: e.stack });
    } else if (typeof e === "string") {
      throw new sdk.InternalServerError(`Error encountered when invoking function '${functionName}'`, { message: e });
    } else {
      throw new sdk.InternalServerError(`Error encountered when invoking function '${functionName}'`);
    }
  }
}

function pruneFields(result: unknown, fields: Record<string, sdk.Field> | null | undefined, functionName: string): unknown {
  if (!fields || Object.keys(fields).length === 0) {
    return result;
  }

  const response: Record<string, unknown> = {};

  if (result === null || Array.isArray(result) || typeof result !== "object")
    throw new sdk.InternalServerError(`Function '${functionName}' did not return an object when expected to`);

  for (const [fieldName,field] of Object.entries(fields)) {
    switch(field.type) {
      case 'column':
        response[fieldName] = (result as Record<string, unknown>)[field.column] ?? null; // Coalesce undefined into null to ensure we always have a value for a requested column
        break;
      default:
        throw new sdk.NotSupported(`Function '${functionName}' field of type '${field.type}' is not supported.`)
    }
  }

  return response;
}
