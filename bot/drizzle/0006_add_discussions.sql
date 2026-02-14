-- Create discussions table
CREATE TABLE IF NOT EXISTS discussions (
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

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_discussions_user_id ON discussions(user_id);

-- Create index on category for filtering
CREATE INDEX IF NOT EXISTS idx_discussions_category ON discussions(category);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_discussions_created_at ON discussions(created_at DESC);
