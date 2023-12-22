abstract class ResultBase<T, TError> {
  map<T2>(fn: (r: T) => T2): Result<T2, TError> {
    if (this instanceof Ok) {
      return new Ok(fn(this.data));
    } else if (this instanceof Err) {
      return new Err(this.error)
    } else {
      throw new Error("Unknown result subclass");
    }
  }

  mapErr<TError2>(fn: (r: TError) => TError2): Result<T, TError2> {
    if (this instanceof Ok) {
      return new Ok(this.data);
    } else if (this instanceof Err) {
      return new Err(fn(this.error))
    } else {
      throw new Error("Unknown result subclass");
    }
  }

  bind<T2>(fn: (r: T) => Result<T2, TError>): Result<T2, TError> {
    if (this instanceof Ok) {
      return fn(this.data);
    } else if (this instanceof Err) {
      return new Err(this.error);
    } else {
      throw new Error("Unknown result subclass");
    }
  }
}

export class Ok<T, TError> extends ResultBase<T, TError> {
  readonly data: T;

  constructor(data: T) {
    super();
    this.data = data;
  }
}

export class Err<T, TError> extends ResultBase<T, TError> {
  readonly error: TError;

  constructor(error: TError) {
    super();
    this.error = error;
  }
}

export type Result<T, TError> = Ok<T, TError> | Err<T, TError>

function traverseAndCollectErrors<T1, T2, TErr>(inputs: T1[], fn: (input: T1) => Result<T2, TErr[]>): Result<T2[], TErr[]> {
  return sequenceAndCollectErrors(inputs.map(fn))
}

function sequenceAndCollectErrors<T, TErr>(results: Result<T, TErr[]>[]): Result<T[], TErr[]> {
  const data: T[] = [];
  const errors: TErr[] = [];

  results.forEach(result => {
    if (result instanceof Ok) {
      data.push(result.data);
    } else {
      errors.push(...result.error);
    }
  });

  return errors.length > 0
    ? new Err(errors)
    : new Ok(data);
}

function partitionAndCollectErrors<T, TErr>(results: Result<T, TErr[]>[]): { oks: T[], errs: TErr[] } {
  const partitionedResults: { oks: T[], errs: TErr[] } = {
    oks: [],
    errs: [],
  };

  for (const result of results) {
    if (result instanceof Ok) {
      partitionedResults.oks.push(result.data);
    } else {
      partitionedResults.errs.push(...result.error);
    }
  }

  return partitionedResults;
}

function collectErrors<T1, T2, TErr>(result1: Result<T1, TErr[]>, result2: Result<T2, TErr[]>): Result<[T1, T2], TErr[]> {
  if (result1 instanceof Ok && result2 instanceof Ok) {
    return new Ok([result1.data, result2.data]);
  } else {
    const errors: TErr[] = [];
    if (result1 instanceof Err) errors.push(...result1.error);
    if (result2 instanceof Err) errors.push(...result2.error);
    return new Err(errors);
  }
}

function collectErrors3<T1, T2, T3, TErr>(result1: Result<T1, TErr[]>, result2: Result<T2, TErr[]>, result3: Result<T3, TErr[]>): Result<[T1, T2, T3], TErr[]> {
  if (result1 instanceof Ok && result2 instanceof Ok && result3 instanceof Ok) {
    return new Ok([result1.data, result2.data, result3.data]);
  } else {
    const errors: TErr[] = [];
    if (result1 instanceof Err) errors.push(...result1.error);
    if (result2 instanceof Err) errors.push(...result2.error);
    if (result3 instanceof Err) errors.push(...result3.error);
    return new Err(errors);
  }
}

export const Result = {
  traverseAndCollectErrors,
  sequenceAndCollectErrors,
  partitionAndCollectErrors,
  collectErrors,
  collectErrors3,
}
