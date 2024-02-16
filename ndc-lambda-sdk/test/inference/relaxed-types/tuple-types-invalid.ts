type Tuple<A,B> = [A, B]

/** @allowrelaxedtypes */
export function tupleFunction(
  tuple1: [void],
  tuple2: [string, never],
  tupleAlias: Tuple<number, Promise<boolean>>
): string {
  return "wow";
}
