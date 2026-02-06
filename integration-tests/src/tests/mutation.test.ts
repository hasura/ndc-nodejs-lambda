import { expect } from "chai";
import { client } from "./root-hooks";

function makeMutationRequest(
  procedureName: string,
  args: Record<string, unknown>,
  fields?: object | null
): object {
  return {
    operations: [
      {
        type: "procedure",
        name: procedureName,
        arguments: args,
        fields: fields ?? null,
      },
    ],
    collection_relationships: {},
  };
}

async function mutateScalar(procedureName: string, args: Record<string, unknown>): Promise<any> {
  const response = await client.postMutation(makeMutationRequest(procedureName, args));
  expect(response.status).to.equal(200);
  const body: any = await response.json();
  return body.operation_results?.[0]?.result;
}

describe("Mutation tests", function () {
  describe("counter procedures", function () {
    it("resetCounter resets to zero", async function () {
      const result = await mutateScalar("resetCounter", {});
      expect(result).to.equal(0);
    });

    it("incrementCounter increments the counter", async function () {
      // Reset first
      await mutateScalar("resetCounter", {});

      const first = await mutateScalar("incrementCounter", {});
      expect(first).to.equal(1);

      const second = await mutateScalar("incrementCounter", {});
      expect(second).to.equal(2);
    });

    it("counter state persists across calls", async function () {
      await mutateScalar("resetCounter", {});
      await mutateScalar("incrementCounter", {});
      await mutateScalar("incrementCounter", {});
      await mutateScalar("incrementCounter", {});

      const result = await mutateScalar("incrementCounter", {});
      expect(result).to.equal(4);
    });
  });

  describe("createUser procedure", function () {
    it("creates a user with name and email", async function () {
      const response = await client.postMutation(
        makeMutationRequest(
          "createUser",
          { name: "Alice", email: "alice@example.com" },
          {
            type: "object",
            fields: {
              name: { type: "column", column: "name" },
              email: { type: "column", column: "email" },
            },
          }
        )
      );
      expect(response.status).to.equal(200);
      const body: any = await response.json();
      const result = body.operation_results?.[0]?.result;
      expect(result).to.deep.include({ name: "Alice", email: "alice@example.com" });
    });

    it("returns user with id field", async function () {
      const response = await client.postMutation(
        makeMutationRequest(
          "createUser",
          { name: "Bob", email: "bob@example.com" },
          {
            type: "object",
            fields: {
              id: { type: "column", column: "id" },
              name: { type: "column", column: "name" },
            },
          }
        )
      );
      expect(response.status).to.equal(200);
      const body: any = await response.json();
      const result = body.operation_results?.[0]?.result;
      expect(result.id).to.be.a("number");
      expect(result.name).to.equal("Bob");
    });
  });

  describe("async procedure", function () {
    it("asyncCreateItem creates an item asynchronously", async function () {
      const response = await client.postMutation(
        makeMutationRequest(
          "asyncCreateItem",
          { title: "Test Item" },
          {
            type: "object",
            fields: {
              id: { type: "column", column: "id" },
              title: { type: "column", column: "title" },
            },
          }
        )
      );
      expect(response.status).to.equal(200);
      const body: any = await response.json();
      const result = body.operation_results?.[0]?.result;
      expect(result).to.deep.equal({ id: "item-1", title: "Test Item" });
    });
  });
});
