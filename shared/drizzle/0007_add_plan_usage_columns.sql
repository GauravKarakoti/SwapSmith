-- Add plan and usage tracking columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free',
ADD COLUMN IF NOT EXISTS daily_chat_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_terminal_count INTEGER NOT NULL DEFAULT 0;

-- Create index on plan for faster queries
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);
