import * as sdk from "@hasura/ndc-lambda-sdk";

// ── Scalar types ──

/** @readonly */
export function hello(name?: string): string {
  return `hello ${name ?? "world"}`;
}

/** @readonly */
export function add(a: number, b: number): number {
  return a + b;
}

/** @readonly */
export function isTrue(value: boolean): boolean {
  return value === true;
}

/** @readonly */
export function echoBigInt(value: bigint): bigint {
  return value;
}

// ── Nullable / optional args ──

/** @readonly */
export function greetNullable(name: string | null): string {
  return `hello ${name ?? "anonymous"}`;
}

/** @readonly */
export function greetOptional(name?: string): string {
  return `hello ${name ?? "default"}`;
}

// ── Object types ──

export type Coordinates = {
  lat: number;
  lng: number;
};

export type Place = {
  name: string;
  location: Coordinates;
};

/** @readonly */
export function getDistance(from: Coordinates, to: Coordinates): number {
  return Math.sqrt(
    Math.pow(to.lat - from.lat, 2) + Math.pow(to.lng - from.lng, 2)
  );
}

/** @readonly */
export function describePlace(place: Place): string {
  return `${place.name} is at (${place.location.lat}, ${place.location.lng})`;
}

// ── Array types ──

/** @readonly */
export function sumArray(numbers: number[]): number {
  return numbers.reduce((acc, n) => acc + n, 0);
}

/** @readonly */
export function reverseStrings(items: string[]): string[] {
  return [...items].reverse();
}

// ── Nested return types ──

type Address = {
  street: string;
  city: string;
};

type PersonWithAddress = {
  name: string;
  age: number;
  address: Address;
};

/** @readonly */
export function getPersonWithAddress(name: string, age: number, street: string, city: string): PersonWithAddress {
  return { name, age, address: { street, city } };
}

// ── Async functions ──

/** @readonly */
export async function asyncGreet(name: string): Promise<string> {
  return `async hello ${name}`;
}

/** @readonly */
export async function asyncGetPlace(name: string, lat: number, lng: number): Promise<Place> {
  return { name, location: { lat, lng } };
}

// ── Procedures (mutations) ──

let counter = 0;

export function incrementCounter(): number {
  counter += 1;
  return counter;
}

export function resetCounter(): number {
  counter = 0;
  return counter;
}

type User = {
  id: number;
  name: string;
  email: string;
};

let nextUserId = 1;

export function createUser(name: string, email: string): User {
  return { id: nextUserId++, name, email };
}

type Item = {
  id: string;
  title: string;
};

export async function asyncCreateItem(title: string): Promise<Item> {
  return { id: "item-1", title };
}

// ── SDK error functions ──

/** @readonly */
export function throwForbidden(): string {
  throw new sdk.Forbidden("access denied", { reason: "no permission" });
}

/** @readonly */
export function throwConflict(): string {
  throw new sdk.Conflict("resource conflict", { resource: "item" });
}

/** @readonly */
export function throwUnprocessable(): string {
  throw new sdk.UnprocessableContent("invalid input", { field: "name" });
}

/** @readonly */
export function throwInternalError(): string {
  throw new Error("something went wrong");
}
