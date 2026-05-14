import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./lib/db/src/schema/index.ts";

const { Pool } = pg;
const dbUrl = readFileSync("artifacts/api-server/.env.migration", "utf8").trim();

async function getUsers() {
  const pool = new Pool({ connectionString: dbUrl });
  const db = drizzle(pool, { schema });
  try {
    const users = await db.select().from(schema.usersTable).limit(5);
    console.log(JSON.stringify(users, null, 2));
  } catch (e) {
    console.error("DB Error:", e.message);
  } finally {
    await pool.end();
  }
}

getUsers();
