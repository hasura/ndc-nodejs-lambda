function nonExported() {
}

export function hello(): string {
  return 'hello world';
}

/**
 * @pure
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * @pure
 */
export function isEven(x: bigint): boolean {
  return x % 2n === 0n;
}

export function dateTime(): Date {
  return new Date("2024-01-11T13:09:23Z");
}
