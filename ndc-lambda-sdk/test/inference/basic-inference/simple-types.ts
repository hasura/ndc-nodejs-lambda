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
