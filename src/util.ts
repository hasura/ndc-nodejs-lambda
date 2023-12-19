export const unreachable = (x: never): never => { throw new Error(`Unreachable code reached! The types lied! 😭 Unexpected value: ${x}`) };

// Throws an error. Useful for using after a short-circuiting ?? operator to eliminate null/undefined from the type
export function throwError<T>(...args: ConstructorParameters<typeof Error>): NonNullable<T> {
  throw new Error(...args);
}
