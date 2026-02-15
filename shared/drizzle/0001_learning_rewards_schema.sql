DO $$ BEGIN
 CREATE TYPE "reward_action_type" AS ENUM('course_complete', 'module_complete', 'daily_login', 'swap_complete', 'referral');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "mint_status_type" AS ENUM('pending', 'processing', 'minted', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "total_points" integer DEFAULT 0 NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "total_tokens_claimed" numeric(20, 8) DEFAULT 0 NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_wallet_address_unique" UNIQUE("wallet_address");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "course_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"course_id" text NOT NULL,
	"course_title" text NOT NULL,
	"completed_modules" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"total_modules" integer NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completion_date" timestamp,
	"last_accessed" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "course_progress_user_course_unique" UNIQUE("user_id", "course_id")
);

CREATE TABLE IF NOT EXISTS "rewards_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"action_type" "reward_action_type" NOT NULL,
	"action_metadata" jsonb,
	"points_earned" integer DEFAULT 0 NOT NULL,
	"tokens_pending" numeric(20, 8) DEFAULT 0 NOT NULL,
	"mint_status" "mint_status_type" DEFAULT 'pending' NOT NULL,
	"tx_hash" text,
	"blockchain_network" text,
	"error_message" text,
	"claimed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "rewards_log" ADD CONSTRAINT "rewards_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_users_total_points" ON "users" ("total_points" DESC);
CREATE INDEX IF NOT EXISTS "idx_users_total_tokens_claimed" ON "users" ("total_tokens_claimed" DESC);
CREATE INDEX IF NOT EXISTS "idx_users_wallet_address" ON "users" ("wallet_address");

CREATE INDEX IF NOT EXISTS "idx_course_progress_user_id" ON "course_progress" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_course_progress_course_id" ON "course_progress" ("course_id");
CREATE INDEX IF NOT EXISTS "idx_course_progress_is_completed" ON "course_progress" ("is_completed");
CREATE INDEX IF NOT EXISTS "idx_course_progress_completion_date" ON "course_progress" ("completion_date" DESC);

CREATE INDEX IF NOT EXISTS "idx_rewards_log_user_id" ON "rewards_log" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_rewards_log_action_type" ON "rewards_log" ("action_type");
CREATE INDEX IF NOT EXISTS "idx_rewards_log_mint_status" ON "rewards_log" ("mint_status");
CREATE INDEX IF NOT EXISTS "idx_rewards_log_created_at" ON "rewards_log" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_rewards_log_claimed_at" ON "rewards_log" ("claimed_at" DESC);
