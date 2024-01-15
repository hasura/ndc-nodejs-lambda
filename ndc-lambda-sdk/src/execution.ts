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
    const prunedResult = pruneFields(result, queryRequest.query.fields, functionName, functionDefinition.resultType);
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
  const prunedResult = reshapeResultToNdcResponseValue(result, functionDefinition.resultType, mutationOperation.fields ?? {}, functionsSchema.objectTypes);

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
        if (schema.isBuiltInScalarTypeDefinition(type))
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
    if (e instanceof Error) {
      throw new sdk.InternalServerError(`Error encountered when invoking function '${functionName}'`, { message: e.message, stack: e.stack });
    } else if (typeof e === "string") {
      throw new sdk.InternalServerError(`Error encountered when invoking function '${functionName}'`, { message: e });
    } else {
      throw new sdk.InternalServerError(`Error encountered when invoking function '${functionName}'`);
    }
  }
}

export function reshapeResultToNdcResponseValue(value: unknown, type: schema.TypeDefinition, fields: Record<string, sdk.Field> | "AllColumns", objectTypes: schema.ObjectTypeDefinitions): unknown {
  switch (type.type) {
    case "array":
      if (isArray(value)) {
        return value.map(elementValue => reshapeResultToNdcResponseValue(elementValue, type.elementType, fields, objectTypes))
      }
      break;

    case "nullable":
      // Selected fields must always return a value, so they cannot be undefined. So all
      // undefineds are coerced to nulls so that the field is included with a null value.
      return value === null || value === undefined
        ? null
        : reshapeResultToNdcResponseValue(value, type.underlyingType, fields, objectTypes);

    case "named":
      switch (type.kind) {
        case "scalar":
          return schema.isTypeNameBuiltInScalar(type.name)
            ? convertJsScalarToNdcJsonScalar(value, type.name)
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
                return reshapeResultToNdcResponseValue((value as Record<string, unknown>)[field.column], objPropDef.type, "AllColumns", objectTypes)

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

function pruneFields(result: unknown, fields: Record<string, sdk.Field> | null | undefined, functionName: string, returnType: schema.TypeDefinition): unknown {
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

function convertBuiltInNdcJsonScalarToJsScalar(value: unknown, valuePath: string[], scalarType: schema.BuiltInScalarTypeDefinition): string | number | boolean | BigInt | Date {
  switch (scalarType.name) {
    case schema.BuiltInScalarTypeName.String:
      if (typeof value === "string") {
        if (scalarType.literalValue !== undefined && value !== scalarType.literalValue)
          throw new sdk.BadRequest(`Invalid value in function arguments. Only the value '${scalarType.literalValue}' is accepted at '${valuePath.join(".")}', got '${value}'`);
        return value;
      } else {
        throw new sdk.BadRequest(`Unexpected value in function arguments. Expected a string at '${valuePath.join(".")}', got a ${typeof value}`);
      }

    case schema.BuiltInScalarTypeName.Float:
      if (typeof value === "number") {
        if (scalarType.literalValue !== undefined && value !== scalarType.literalValue)
          throw new sdk.BadRequest(`Invalid value in function arguments. Only the value '${scalarType.literalValue}' is accepted at '${valuePath.join(".")}', got '${value}'`);
        return value;
      } else {
        throw new sdk.BadRequest(`Unexpected value in function arguments. Expected a number at '${valuePath.join(".")}', got a ${typeof value}`);
      }

    case schema.BuiltInScalarTypeName.Boolean:
      if (typeof value === "boolean") {
        if (scalarType.literalValue !== undefined && value !== scalarType.literalValue)
          throw new sdk.BadRequest(`Invalid value in function arguments. Only the value '${scalarType.literalValue}' is accepted at '${valuePath.join(".")}', got '${value}'`);
        return value;
      } else {
        throw new sdk.BadRequest(`Unexpected value in function arguments. Expected a boolean at '${valuePath.join(".")}', got a ${typeof value}`);
      }

    case schema.BuiltInScalarTypeName.BigInt:
      const bigIntValue = (() => {
        if (typeof value === "number") {
          if (!Number.isInteger(value))
            throw new sdk.BadRequest(`Unexpected value in function arguments. Expected a integer number at '${valuePath.join(".")}', got a float`);
          return BigInt(value);
        }
        else if (typeof value === "string") {
          try { return BigInt(value) }
          catch { throw new sdk.BadRequest(`Unexpected value in function arguments. Expected a bigint string at '${valuePath.join(".")}', got a non-integer string: '${value}'`); }
        }
        else if (typeof value === "bigint") { // This won't happen since JSON doesn't have a bigint type, but I'll just put it here for completeness
          return value;
        } else {
          throw new sdk.BadRequest(`Unexpected value in function arguments. Expected a bigint at '${valuePath.join(".")}', got a ${typeof value}`);
        }
      })();
      if (scalarType.literalValue !== undefined && bigIntValue !== scalarType.literalValue)
        throw new sdk.BadRequest(`Invalid value in function arguments. Only the value '${scalarType.literalValue}' is accepted at '${valuePath.join(".")}', got '${value}'`);
      return bigIntValue;

    case schema.BuiltInScalarTypeName.DateTime:
      if (typeof value === "string") {
        const parsedDate = Date.parse(value);
        if (isNaN(parsedDate))
          throw new sdk.BadRequest(`Unexpected value in function arguments. Expected a Date string at '${valuePath.join(".")}', but the value failed to parse: '${value}'`)
        return new Date(parsedDate);
      } else {
        throw new sdk.BadRequest(`Unexpected value in function arguments. Expected a Date string at '${valuePath.join(".")}', got a ${typeof value}`);
      }

    default:
      return unreachable(scalarType);
  }
}

function convertJsScalarToNdcJsonScalar(value: unknown, scalarType: schema.BuiltInScalarTypeName): unknown {
  if (typeof value === "bigint") {
    // BigInts can't be serialized to JSON natively, so put them in strings
    return value.toString();
  } else if (value instanceof Date) {
    return value.toISOString();
  } else {
    return value;
  }
}
