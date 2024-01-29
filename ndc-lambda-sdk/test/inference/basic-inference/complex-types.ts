type Bar = {
  test: string
}

type GenericBar<T> = {
  data: T
}

interface IThing {
  prop: string
}

// This alias just gets erased by the TS compiler
type AliasedIThing = IThing;

interface IGenericThing<T> {
  data: T
}

type AliasedIGenericThing<T> = IGenericThing<T>

type AliasedClosedIGenericThing = IGenericThing<number>

type IntersectionObject = { wow: string } & Bar

type GenericIntersectionObject<T> = { data: T } & Bar

// This alias just gets erased by the TS compiler
type AliasedString = string;

// These aliases just get erased by the TS compiler
type GenericScalar<T> = GenericScalar2<T>
type GenericScalar2<T> = T

export function bar(
  string: string,
  aliasedString: AliasedString,
  genericScalar: GenericScalar<string>,
  array: string[],
  anonObj: {a: number, b: string},
  aliasedObj: Bar,
  genericAliasedObj: GenericBar<string>,
  genericAliasedObjWithComplexTypeParam: GenericBar<Bar>,
  interfce: IThing,
  aliasedInterface: AliasedIThing,
  genericInterface: IGenericThing<string>,
  aliasedGenericInterface: AliasedIGenericThing<number>,
  aliasedClosedInterface: AliasedClosedIGenericThing,
  aliasedIntersectionObj: IntersectionObject,
  anonIntersectionObj: {num:number} & Bar,
  genericIntersectionObj: GenericIntersectionObject<string>,
  ): string {
  return 'hello';
}
