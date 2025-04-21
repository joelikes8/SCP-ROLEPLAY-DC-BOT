import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon to use WebSockets
neonConfig.webSocketConstructor = ws;

// Check if we're running on Render
const isRender = process.env.RENDER === 'true' || process.env.IS_RENDER === 'true' || !!process.env.RENDER_EXTERNAL_URL;

// If we're on Render, we should expect a RENDER_DATABASE_URL for a separate database
// Otherwise, fall back to the standard DATABASE_URL which works in the Replit environment
const databaseUrl = isRender && process.env.RENDER_DATABASE_URL 
  ? process.env.RENDER_DATABASE_URL 
  : process.env.DATABASE_URL;

// Log environment for debugging
console.log('Environment:', process.env.NODE_ENV);
console.log('Is Render:', isRender);
console.log('Using database connection:', databaseUrl ? 'Yes (URL defined)' : 'No (URL not defined)');

// In-memory fallback data
let inMemoryMode = false;
let inMemoryUsers = [];
let inMemoryDiscordUsers = [];
let inMemoryPatrolSessions = [];
let inMemoryVerifications = [];

// Create a connection pool if database URL is available
let pool: Pool | null = null;

if (databaseUrl) {
  try {
    // Create a connection pool with better error handling and retry settings
    pool = new Pool({
      connectionString: databaseUrl,
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
  } catch (err) {
    console.error('Error creating database pool:', err);
    inMemoryMode = true;
    console.log('⚠️ Falling back to in-memory mode');
  }
} else {
  console.warn('⚠️ No DATABASE_URL provided, using in-memory mode');
  inMemoryMode = true;
}

// Create a Drizzle ORM instance with the pool or use in-memory mode
export const db = pool ? drizzle({ client: pool, schema }) : null;

// Helper function to check database connection
export async function checkDatabaseConnection(): Promise<boolean> {
  if (inMemoryMode) {
    console.log('Using in-memory storage mode (no database connection)');
    return true;
  }
  
  try {
    if (!pool) {
      console.error('Database pool is not initialized');
      console.log('⚠️ Falling back to in-memory mode due to missing database pool');
      inMemoryMode = true;
      return false;
    }
    
    // Try a simple query to verify connection
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      console.log('✅ Database connection verified successfully');
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database connection check failed:', error);
    console.log('⚠️ Falling back to in-memory mode due to database connection failure');
    inMemoryMode = true;
    return false;
  }
}

// Export pool and in-memory mode status
export { pool, inMemoryMode };
