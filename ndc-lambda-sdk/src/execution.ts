import { EOL } from "os";
import * as sdk from "@hasura/ndc-sdk-typescript"
import { withActiveSpan } from "@hasura/ndc-sdk-typescript/instrumentation"
import opentelemetry from '@opentelemetry/api';
import pLimit from "p-limit";
import * as schema from "./schema"
import { isArray, mapObjectValues, unreachable } from "./util"

const tracer = opentelemetry.trace.getTracer("nodejs-lambda-sdk.execution");

export type RuntimeFunctions = {
  [functionName: string]: Function
}

// This number is chosen arbitrarily, just to place _some_ limit on the amount of
// parallelism going on within a single query
const DEFAULT_PARALLEL_DEGREE = 10;

const FUNCTION_NAME_SPAN_ATTR_NAME = "ndc-lambda-sdk.function_name";
const FUNCTION_INVOCATION_INDEX_SPAN_ATTR_NAME = "ndc-lambda-sdk.function_invocation_index";

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

  const spanAttributes = { [FUNCTION_NAME_SPAN_ATTR_NAME]: functionName };

  const functionInvocationPreparedArgs = withActiveSpan(tracer, "prepare arguments", () =>
    (queryRequest.variables ?? [{}]).map(variables => {
      const resolvedArgs = resolveArgumentValues(queryRequest.arguments, variables);
      return prepareArguments(resolvedArgs, functionDefinition, functionsSchema.objectTypes);
    })
  , spanAttributes);

  const parallelLimit = pLimit(functionDefinition.parallelDegree ?? DEFAULT_PARALLEL_DEGREE);
  const functionInvocations: Promise<sdk.RowSet>[] = functionInvocationPreparedArgs.map((invocationPreparedArgs, invocationIndex) => parallelLimit(async () => {
    const invocationSpanAttrs = {...spanAttributes, [FUNCTION_INVOCATION_INDEX_SPAN_ATTR_NAME]: invocationIndex};

    return withActiveSpan(tracer, "function invocation", async () => {
      const result = await invokeFunction(runtimeFunction, invocationPreparedArgs, functionName);

      return withActiveSpan(tracer, "reshape result", () =>
        reshapeResultUsingFunctionCallingConvention(result, functionDefinition.resultType, queryRequest.query, functionsSchema.objectTypes)
      , invocationSpanAttrs);

    }, invocationSpanAttrs);
  }));

  return await Promise.all(functionInvocations);
}

export async function executeMutation(mutationRequest: sdk.MutationRequest, functionsSchema: schema.FunctionsSchema, runtimeFunctions: RuntimeFunctions): Promise<sdk.MutationResponse> {
  if (mutationRequest.operations.length > 1)
    throw new sdk.NotSupported("Transactional mutations (multiple operations) are not supported");
  if (mutationRequest.operations.length <= 0)
    throw new sdk.BadRequest("One mutation operation must be provided")

  const mutationOperation = mutationRequest.operations[0]!;
  const result = await executeMutationOperation(mutationOperation, functionsSchema, runtimeFunctions);

  return {
    operation_results: [result]
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

  const spanAttributes = { [FUNCTION_NAME_SPAN_ATTR_NAME]: functionName };

  const runtimeFunction = runtimeFunctions[functionName];
  if (runtimeFunction === undefined)
    throw new sdk.InternalServerError(`Couldn't find ${functionName} function exported from hosted functions module.`)

  const preparedArgs = withActiveSpan(tracer, "prepare arguments", () =>
    prepareArguments(mutationOperation.arguments, functionDefinition, functionsSchema.objectTypes)
  , spanAttributes);

  const result = await invokeFunction(runtimeFunction, preparedArgs, functionName);

  const reshapedResult = withActiveSpan(tracer, "reshape result", () =>
    reshapeResultUsingFieldSelection(result, functionDefinition.resultType, [], mutationOperation.fields ?? { type: "scalar" }, functionsSchema.objectTypes)
  , spanAttributes);

  return {
    type: "procedure",
    result: reshapedResult
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
    return await withActiveSpan(tracer, `Function: ${functionName}`, async () => {
      const result = func.apply(undefined, preparedArgs);
      // Await the result if it is a promise
      if (result && typeof result === "object" && 'then' in result && typeof result.then === "function") {
        return await result;
      }
      return result;
    }, { [FUNCTION_NAME_SPAN_ATTR_NAME]: functionName });
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

// Represents either selecting a scalar (ie. the whole value, opaquely), an object (selecting properties), or an array (select whole array)
export type FieldSelection = sdk.NestedField | { type: "scalar" }

function reshapeResultUsingFunctionCallingConvention(functionResultValue: unknown, functionResultType: schema.TypeReference, query: sdk.Query, objectTypes: schema.ObjectTypeDefinitions): sdk.RowSet {
  if (query.aggregates) throw new sdk.NotSupported("Query aggregates are not supported");
  if (query.order_by) throw new sdk.NotSupported("Query order_by is not supported");
  if (query.predicate) throw new sdk.NotSupported("Query predicate is not supported");
  if (!query.fields) {
    return {
      aggregates: null,
      rows: null,
    }
  }
  // There's one virtual row in the function calling convention, so if the query (pointlessly) usees
  // pagination to skip it, just do what it says
  if (query.limit !== undefined && query.limit !== null && query.limit <= 0
      || query.offset !== undefined && query.offset !== null && query.offset >= 1) {
    return {
      aggregates: null,
      rows: [],
    }
  }

  const rowValue = mapObjectValues(query.fields, (field: sdk.Field, fieldName: string) => {
    switch (field.type) {
      case "column":
        if (field.column === "__value") {
          return reshapeResultUsingFieldSelection(functionResultValue, functionResultType, [fieldName], field.fields ?? { type: "scalar" }, objectTypes);
        } else {
          throw new sdk.BadRequest(`Unknown column '${field.column}' used in root query field`)
        }

      case "relationship":
        throw new sdk.NotSupported(`Field '${fieldName}' is a relationship field, which is unsupported.'`)

      default:
        return unreachable(field["type"]);
    }
  });

  return {
    aggregates: null,
    rows: [rowValue]
  }
}

export function reshapeResultUsingFieldSelection(value: unknown, type: schema.TypeReference, valuePath: string[], fieldSelection: FieldSelection, objectTypes: schema.ObjectTypeDefinitions): unknown {
  switch (type.type) {
    case "array":
      if (!isArray(value))
        throw new sdk.InternalServerError(`Expected an array, but received '${value === null ? "null" : null ?? typeof value}'`);

      const elementFieldSelection = (() => {
        switch (fieldSelection.type) {
          case "scalar": return fieldSelection;
          case "array": return fieldSelection.fields;
          case "object": throw new sdk.BadRequest(`Trying to perform an object selection on an array type at '${valuePath.join(".")}'`)
          default: return unreachable(fieldSelection["type"]);
        }
      })();

      return value.map((elementValue, index) => reshapeResultUsingFieldSelection(elementValue, type.elementType, [...valuePath, `[${index}]`], elementFieldSelection, objectTypes))


    case "nullable":
      // Selected fields must always return a value, so they cannot be undefined. So all
      // undefineds are coerced to nulls so that the field is included with a null value.
      return value === null || value === undefined
        ? null
        : reshapeResultUsingFieldSelection(value, type.underlyingType, valuePath, fieldSelection, objectTypes);

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

          const selectedFields: Record<string, sdk.Field> = (() => {
            switch (fieldSelection.type) {
              case "scalar": return Object.fromEntries(objectType.properties.map(propDef => [propDef.propertyName, { type: "column", column: propDef.propertyName }]));
              case "array": throw new sdk.BadRequest(`Trying to perform an array selection on an object type at '${valuePath.join(".")}'`);
              case "object": return fieldSelection.fields;
              default: return unreachable(fieldSelection["type"]);
            }
          })();

          return mapObjectValues(selectedFields, (field, fieldName) => {
            switch(field.type) {
              case "column":
                const objPropDef = objectType.properties.find(prop => prop.propertyName === field.column);
                if (objPropDef === undefined)
                  throw new sdk.BadRequest(`Unable to find property definition '${field.column}' on object type '${type.name}' at '${valuePath.join(".")}'`);

                const columnFieldSelection = field.fields ?? { type: "scalar" };
                return reshapeResultUsingFieldSelection((value as Record<string, unknown>)[field.column], objPropDef.type, [...valuePath, fieldName], columnFieldSelection, objectTypes)

              case "relationship":
                throw new sdk.NotSupported(`Field '${fieldName}' is a relationship field, which is unsupported.'`)

              default:
                return unreachable(field["type"]);
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
