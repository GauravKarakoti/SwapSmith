-- Migration: Add page_visits and groq_usage_logs tables for admin stats

CREATE TABLE IF NOT EXISTS "page_visits" (
  "id" serial PRIMARY KEY NOT NULL,
  "page" text NOT NULL,
  "user_id" text,
  "session_id" text,
  "user_agent" text,
  "referer" text,
  "visited_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "groq_usage_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text,
  "model" text NOT NULL,
  "endpoint" text DEFAULT 'chat' NOT NULL,
  "prompt_tokens" integer DEFAULT 0 NOT NULL,
  "completion_tokens" integer DEFAULT 0 NOT NULL,
  "total_tokens" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now()
);

-- Indexes for page_visits
CREATE INDEX IF NOT EXISTS "idx_page_visits_page" ON "page_visits" ("page");
CREATE INDEX IF NOT EXISTS "idx_page_visits_visited_at" ON "page_visits" ("visited_at");
CREATE INDEX IF NOT EXISTS "idx_page_visits_user_id" ON "page_visits" ("user_id");

-- Indexes for groq_usage_logs
CREATE INDEX IF NOT EXISTS "idx_groq_usage_logs_user_id" ON "groq_usage_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_groq_usage_logs_created_at" ON "groq_usage_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_groq_usage_logs_model" ON "groq_usage_logs" ("model");
