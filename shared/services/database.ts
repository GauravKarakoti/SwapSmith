import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import dotenv from 'dotenv';

dotenv.config();

// Import schema from shared schema
import * as schema from '../schema';

const connectionString = process.env.DATABASE_URL || 'postgres://mock:mock@localhost:5432/mock';
const client = neon(connectionString);

// Initialize drizzle with schema
export const db = drizzle(client, { schema });

// Re-export schema for convenience
export { schema };
