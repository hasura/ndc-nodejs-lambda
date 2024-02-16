type Tuple<A,B> = [A, B]

/** @allowrelaxedtypes */
export function tupleFunction(
  tuple1: [string],
  tuple2: [string, number],
  tupleAlias: Tuple<number, boolean>
): string {
  return "wow";
}
