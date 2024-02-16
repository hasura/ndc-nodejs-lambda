import { EOL } from "os";
import * as sdk from "@hasura/ndc-sdk-typescript"
import pLimit from "p-limit";
import * as schema from "./schema"
import { isArray, mapObjectValues, unreachable } from "./util"

export type RuntimeFunctions = {
  [functionName: string]: Function
}

// This number is chosen arbitrarily, just to place _some_ limit on the amount of
// parallelism going on within a single query
const DEFAULT_PARALLEL_DEGREE = 10;

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

  const parallelLimit = pLimit(functionDefinition.parallelDegree ?? DEFAULT_PARALLEL_DEGREE);
  const functionInvocations: Promise<sdk.RowSet>[] = functionInvocationPreparedArgs.map(invocationPreparedArgs => parallelLimit(async () => {
    const result = await invokeFunction(runtimeFunction, invocationPreparedArgs, functionName);
    const prunedResult = reshapeResultToNdcResponseValue(result, functionDefinition.resultType, [], queryRequest.query.fields ?? {}, functionsSchema.objectTypes);
    return {
      aggregates: {},
      rows: [
        {
          __value: prunedResult
        }
      ]
    };
  }));

  return await Promise.all(functionInvocations);
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
  const prunedResult = reshapeResultToNdcResponseValue(result, functionDefinition.resultType, [], mutationOperation.fields ?? {}, functionsSchema.objectTypes);

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

function coerceArgumentValue(value: unknown, type: schema.TypeReference, valuePath: string[], objectTypeDefinitions: schema.ObjectTypeDefinitions): unknown {
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
        if (schema.isBuiltInScalarTypeReference(type))
          return convertBuiltInNdcJsonScalarToJsScalar(value, valuePath, type);
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
    if (e instanceof sdk.ConnectorError) {
      throw e;
    } else if (e instanceof Error) {
      throw new sdk.InternalServerError(`Error encountered when invoking function '${functionName}'`, getErrorDetails(e));
    } else if (typeof e === "string") {
      throw new sdk.InternalServerError(`Error encountered when invoking function '${functionName}'`, { message: e });
    } else {
      throw new sdk.InternalServerError(`Error encountered when invoking function '${functionName}'`);
    }
  }
}

export type ErrorDetails = {
  message: string
  stack: string
}

export function getErrorDetails(error: Error): ErrorDetails {
  return {
    message: error.message,
    stack: buildCausalStackTrace(error),
  }
}

function buildCausalStackTrace(error: Error): string {
  let seenErrs: Error[] = [];
  let currErr: Error | undefined = error;
  let stackTrace = "";

  while (currErr) {
    seenErrs.push(currErr);

    if (currErr.stack) {
      stackTrace += `${currErr.stack}${EOL}`;
    } else {
      stackTrace += `${currErr.toString()}${EOL}`;
    }
    if (currErr.cause instanceof Error) {
      if (seenErrs.includes(currErr.cause)) {
        stackTrace += "<circular error cause loop>"
        currErr = undefined;
      } else {
        stackTrace += `caused by `;
        currErr = currErr.cause;
      }

    } else {
      currErr = undefined;
    }
  }
  return stackTrace;
}

export function reshapeResultToNdcResponseValue(value: unknown, type: schema.TypeReference, valuePath: string[], fields: Record<string, sdk.Field> | "AllColumns", objectTypes: schema.ObjectTypeDefinitions): unknown {
  switch (type.type) {
    case "array":
      if (isArray(value)) {
        return value.map((elementValue, index) => reshapeResultToNdcResponseValue(elementValue, type.elementType, [...valuePath, `[${index}]`], fields, objectTypes))
      }
      break;

    case "nullable":
      // Selected fields must always return a value, so they cannot be undefined. So all
      // undefineds are coerced to nulls so that the field is included with a null value.
      return value === null || value === undefined
        ? null
        : reshapeResultToNdcResponseValue(value, type.underlyingType, valuePath, fields, objectTypes);

    case "named":
      switch (type.kind) {
        case "scalar":
          return schema.isTypeNameBuiltInScalar(type.name)
            ? convertJsScalarToNdcJsonScalar(value, valuePath)
            : value; // YOLO? Just try to serialize it to JSON as is as an opaque scalar.

        case "object":
          const objectType = objectTypes[type.name];
          if (objectType === undefined)
            throw new sdk.InternalServerError(`Unable to find object type definition '${type.name}'`)
          if (value === null || Array.isArray(value) || typeof value !== "object")
            throw new sdk.InternalServerError(`Expected an object, but received '${value === null ? "null" : null ?? Array.isArray(value) ? "array" : null ?? typeof value}'`);

          const selectedFields: Record<string, sdk.Field> =
            fields === "AllColumns"
              ? Object.fromEntries(objectType.properties.map(propDef => [propDef.propertyName, { type: "column", column: propDef.propertyName }]))
              : fields;

          return mapObjectValues(selectedFields, (field, fieldName) => {
            switch(field.type) {
              case "column":
                const objPropDef = objectType.properties.find(prop => prop.propertyName === field.column);
                if (objPropDef === undefined)
                  throw new sdk.InternalServerError(`Unable to find property definition '${field.column}' on object type '${type.name}'`);

                // We pass "AllColumns" as the fields because we don't yet support nested field selections, so we just include all columns by default for now
                return reshapeResultToNdcResponseValue((value as Record<string, unknown>)[field.column], objPropDef.type, [...valuePath, field.column], "AllColumns", objectTypes)

              default:
                throw new sdk.NotSupported(`Field '${fieldName}' uses an unsupported field type: '${field.type}'`)
            }
          })

        default:
          return unreachable(type["kind"]);
      }
    default:
      return unreachable(type["type"]);
  }
}

function convertBuiltInNdcJsonScalarToJsScalar(value: unknown, valuePath: string[], scalarType: schema.BuiltInScalarTypeReference): string | number | boolean | BigInt | Date | schema.JSONValue {
  switch (scalarType.name) {
    case schema.BuiltInScalarTypeName.String:
      if (typeof value === "string") {
        if (scalarType.literalValue !== undefined && value !== scalarType.literalValue)
          throw new sdk.UnprocessableContent(`Invalid value in function arguments. Only the value '${scalarType.literalValue}' is accepted at '${valuePath.join(".")}', got '${value}'`);
        return value;
      } else {
        throw new sdk.BadRequest(`Unexpected value in function arguments. Expected a string at '${valuePath.join(".")}', got a ${typeof value}`);
      }

    case schema.BuiltInScalarTypeName.Float:
      if (typeof value === "number") {
        if (scalarType.literalValue !== undefined && value !== scalarType.literalValue)
          throw new sdk.UnprocessableContent(`Invalid value in function arguments. Only the value '${scalarType.literalValue}' is accepted at '${valuePath.join(".")}', got '${value}'`);
        return value;
      } else {
        throw new sdk.BadRequest(`Unexpected value in function arguments. Expected a number at '${valuePath.join(".")}', got a ${typeof value}`);
      }

    case schema.BuiltInScalarTypeName.Boolean:
      if (typeof value === "boolean") {
        if (scalarType.literalValue !== undefined && value !== scalarType.literalValue)
          throw new sdk.UnprocessableContent(`Invalid value in function arguments. Only the value '${scalarType.literalValue}' is accepted at '${valuePath.join(".")}', got '${value}'`);
        return value;
      } else {
        throw new sdk.BadRequest(`Unexpected value in function arguments. Expected a boolean at '${valuePath.join(".")}', got a ${typeof value}`);
      }

    case schema.BuiltInScalarTypeName.BigInt:
      const bigIntValue = (() => {
        if (typeof value === "number") {
          if (!Number.isInteger(value))
            throw new sdk.UnprocessableContent(`Invalid value in function arguments. Expected a integer number at '${valuePath.join(".")}', got a float: '${value}'`);
          return BigInt(value);
        }
        else if (typeof value === "string") {
          try { return BigInt(value) }
          catch { throw new sdk.UnprocessableContent(`Invalid value in function arguments. Expected a bigint string at '${valuePath.join(".")}', got a non-integer string: '${value}'`); }
        }
        else if (typeof value === "bigint") { // This won't happen since JSON doesn't have a bigint type, but I'll just put it here for completeness
          return value;
        } else {
          throw new sdk.BadRequest(`Unexpected value in function arguments. Expected a bigint at '${valuePath.join(".")}', got a ${typeof value}`);
        }
      })();
      if (scalarType.literalValue !== undefined && bigIntValue !== scalarType.literalValue)
        throw new sdk.UnprocessableContent(`Invalid value in function arguments. Only the value '${scalarType.literalValue}' is accepted at '${valuePath.join(".")}', got '${value}'`);
      return bigIntValue;

    case schema.BuiltInScalarTypeName.DateTime:
      if (typeof value === "string") {
        const parsedDate = Date.parse(value);
        if (isNaN(parsedDate))
          throw new sdk.UnprocessableContent(`Invalid value in function arguments. Expected an ISO 8601 calendar date extended format string at '${valuePath.join(".")}', but the value failed to parse: '${value}'`)
        return new Date(parsedDate);
      } else {
        throw new sdk.BadRequest(`Unexpected value in function arguments. Expected a ISO 8601 calendar date extended format string at '${valuePath.join(".")}', got a ${typeof value}`);
      }

    case schema.BuiltInScalarTypeName.JSON:
      if (value === undefined) {
        throw new sdk.BadRequest(`Unexpected value in function arguments. Expected a JSONValue at '${valuePath.join(".")}', got undefined`);
      }
      return new schema.JSONValue(value, true);

    default:
      return unreachable(scalarType);
  }
}

function convertJsScalarToNdcJsonScalar(value: unknown, valuePath: string[]): unknown {
  if (typeof value === "bigint") {
    // BigInts can't be serialized to JSON natively, so put them in strings
    return value.toString();
  } else if (value instanceof Date) {
    return value.toISOString();
  } else if (value instanceof schema.JSONValue) {
    if (value.validationError) {
      throw new sdk.InternalServerError(`Unable to serialize JSONValue to JSON at path '${valuePath.join(".")}: ${value.validationError.message}'`)
    }
    return value.value;
  } else {
    return value;
  }
}
