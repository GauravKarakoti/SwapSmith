-- Fix discussions table schema
-- Drop the table and recreate with correct types
DROP TABLE IF EXISTS discussions CASCADE;

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
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_discussions_user_id ON discussions(user_id);
CREATE INDEX IF NOT EXISTS idx_discussions_category ON discussions(category);
CREATE INDEX IF NOT EXISTS idx_discussions_created_at ON discussions(created_at DESC);
