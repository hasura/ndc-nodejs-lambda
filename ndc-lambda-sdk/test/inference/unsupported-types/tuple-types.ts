export function tuple1(test: [string]): string {
  return "wow";
}

export function tuple2(test: [string, number]): string {
  return "wow";
}

type Tuple<A,B> = [A, B]

export function tupleAlias(test: Tuple<number, boolean>): string {
  return "wow";
}
