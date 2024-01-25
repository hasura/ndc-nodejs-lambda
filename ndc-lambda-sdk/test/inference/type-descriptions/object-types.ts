/**
 * My object type is the best object type.
 * You should make all object types like mine.
 */
type MyObjType = {
  /** This is a good property */
  propA: string
}

/**
 * What a great interface
 */
interface IInterface {
  /** The best of all properties */
  prop: string
}

/**
 * The most generic of interfaces
 */
interface IGenericInterface<T> {
  /** Whatever you'd like it to be */
  whatever: T
}

/**
 * Just smashing things together over here
 */
type IntersectionType = MyObjType & {
  /** I'm just adding another prop here */
  anotherProp: string
}

/** @readonly */
export function myFunction(
  myObjType: MyObjType,
  iface: IInterface,
  genericInterface: IGenericInterface<string>,
  intersectionType: IntersectionType
  ): string {
  return ""
}
