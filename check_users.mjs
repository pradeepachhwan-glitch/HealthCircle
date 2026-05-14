import { db, usersTable } from "@workspace/db";

async function getUsers() {
  try {
    const users = await db.select().from(usersTable).limit(5);
    console.log(JSON.stringify(users, null, 2));
  } catch (e) {
    console.error("DB Error:", e.message);
  }
}

getUsers();
