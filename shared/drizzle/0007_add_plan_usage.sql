-- Migration: Add plan subscription and usage tracking fields
-- 0007_add_plan_usage.sql

-- Create plan_type enum
DO $$ BEGIN
  CREATE TYPE "plan_type" AS ENUM('free', 'premium', 'pro');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add plan and usage columns to users table
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "plan" "plan_type" NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS "plan_purchased_at" timestamp,
  ADD COLUMN IF NOT EXISTS "plan_expires_at" timestamp,
  ADD COLUMN IF NOT EXISTS "daily_chat_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "daily_terminal_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "usage_reset_at" timestamp DEFAULT now();

-- Create plan_purchases table
CREATE TABLE IF NOT EXISTS "plan_purchases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "plan" "plan_type" NOT NULL,
  "coins_spent" integer NOT NULL,
  "duration_days" integer NOT NULL,
  "activated_at" timestamp NOT NULL DEFAULT now(),
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_plan_purchases_user_id" ON "plan_purchases" ("user_id");
