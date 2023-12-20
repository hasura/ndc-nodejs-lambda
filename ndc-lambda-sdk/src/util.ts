export const unreachable = (x: never): never => { throw new Error(`Unreachable code reached! The types lied! 😭 Unexpected value: ${x}`) };

export function isArray(x: unknown): x is unknown[] {
  return Array.isArray(x);
}

// Throws an error. Useful for using after a short-circuiting ?? operator to eliminate null/undefined from the type
export function throwError<T>(...args: ConstructorParameters<typeof Error>): NonNullable<T> {
  throw new Error(...args);
}

export function mapObjectValues<T, U>(obj: { [k: string]: T }, fn: (value: T, propertyName: string) => U): Record<string, U> {
  return Object.fromEntries(Object.entries(obj).map(([prop, val]) => [prop, fn(val, prop)]));
}
