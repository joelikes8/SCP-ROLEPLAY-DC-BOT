import { db } from "./server/db";
import { discordUsers } from "./shared/schema";

async function testConnection() {
  try {
    console.log("Testing database connection...");
    const result = await db.select().from(discordUsers);
    console.log("Success! Found", result.length, "users");
    console.log(result);
  } catch (err) {
    console.error("Database query failed:", err);
  }
}

testConnection();
