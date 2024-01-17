import { Client } from "node-postgres";
import * as sdk from "../../../src/schema";

const dbConfig = {
  user: "aaysha",
  hostname: "asdfasdfasd.us-west-2.aws.neon.tech",
  port: 5432,
  password: "asdfasdasdf",
  database: "asdfasdfasdf",
  ssl: true,
  sslmode: "require",
};

export async function insert_user(
  user_name: string,
): Promise<sdk.JSONValue> {
  const client = new Client(dbConfig);

  try {
    await client.connect();

    const result = await client.query({
      text: `INSERT INTO users(name) VALUES ('${user_name}') RETURNING *`,
    });

    if (result && result.rows.length > 0 && result.rows[0]) {
      return result.rows[0];
    } else {
      return new sdk.JSONValue({ message: "Insert Failed" });
    }
  } catch (error) {
    console.error("Error:", error);
    if (error != null && typeof error === "object" && "message" in error) {
      return new sdk.JSONValue({ error: "Error: " + error.message });
    } else {
      return new sdk.JSONValue({ error: "Unknown error" });
    }
  } finally {
    await client.end();
  }
}

export async function insert_todos(
    user_id: string,
    todo: string
  ): Promise<sdk.JSONValue> {
    const client = new Client(dbConfig);

    try {
      await client.connect();

      // Check if the user exists in the users table
      const userExistsQuery = await client.query({
        text: `SELECT id FROM users where id =${user_id}`
      })

      if (userExistsQuery.rows.length === 0) {
        return new sdk.JSONValue({ message: "User not found. Insert Failed" });
      }
      const result = await client.query({
        text: `INSERT INTO todos(user_id,todo) VALUES ('${user_id}','${todo}') RETURNING *`,
      });

      if (result && result.rows.length > 0 && result.rows[0]) {
        return result.rows[0];
      } else {
        return new sdk.JSONValue({ message: "Insert Failed" });
      }
    } catch (error) {
      console.error("Error:", error);
      if (error != null && typeof error === "object" && "message" in error) {
        return new sdk.JSONValue({ error: "Error: " + error.message });
      } else {
        return new sdk.JSONValue({ error: "Unknown error" });
      }
    } finally {
      await client.end();
    }
  }


  export async function delete_todos(
    todo_id: string
  ): Promise<{ error?: string, result?: string }> {
    const client = new Client(dbConfig);
    try {
      await client.connect();

      const result = await client.query({ text: `DELETE FROM todos WHERE id =${todo_id}`})
      if (result.rowCount === 1) {
        return { result: `Deleted todo with id= ${todo_id} successfully` }
      } else {
        return { result: "Deletion unsuccessful" }
      }
    } catch (error) {
      if (error != null && typeof error === "object" && "message" in error) {
        return { error: "Error: " + error.message };
      } else {
        return { error: "Unknown error" };
      }
    } finally {
        client.end();
    }

  }
