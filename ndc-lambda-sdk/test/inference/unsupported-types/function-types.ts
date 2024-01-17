export function functionExpressionType(test: (i: number) => string): string {
  return "wow";
}

type ObjectWithCallSignature = {
  (x: string): number
}

export function objectWithCallSignature(test: ObjectWithCallSignature): string {
  return "wow";
}

type ObjectWithConstructSignature = {
  new (x: string): number
}

export function objectWithConstructSignature(test: ObjectWithConstructSignature): string {
  return "wow";
}
