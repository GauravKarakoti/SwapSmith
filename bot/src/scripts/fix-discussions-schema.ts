import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';
import logger from '../services/logger';

// Load .env from bot directory
dotenv.config({ path: path.join(__dirname, '../../.env') });


const sql = neon(process.env.DATABASE_URL!);

async function runMigration() {
  try {
    logger.info('Starting migration to fix discussions table schema...');
    
    logger.info('Executing SQL...');

    
    // Drop table if exists
    await sql`DROP TABLE IF EXISTS discussions CASCADE`;
    
    // Create table with correct schema
    await sql`
      CREATE TABLE discussions (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        likes TEXT DEFAULT '0',
        replies TEXT DEFAULT '0',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    
    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_discussions_user_id ON discussions(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_discussions_category ON discussions(category)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_discussions_created_at ON discussions(created_at DESC)`;
    
    logger.info('✅ Migration completed successfully!');
    logger.info('The discussions table has been recreated with correct schema.');
    
  } catch (error) {
    logger.error('❌ Migration failed:', error);

    process.exit(1);
  }
}

runMigration();
