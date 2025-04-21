import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon to use WebSockets
neonConfig.webSocketConstructor = ws;

// Ensure we have a database URL
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create a connection pool with better error handling and retry settings
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 10000, // How long to wait for a connection
  maxUses: 7500, // How many times a client can be used before being destroyed and recreated
});

// Set up error handling for the connection pool
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
  // Don't crash on connection errors, allow reconnection
});

// Create a Drizzle ORM instance with the pool
export const db = drizzle({ client: pool, schema });

// Helper function to check database connection
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    // Try a simple query to verify connection
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      console.log('Database connection verified successfully');
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}
