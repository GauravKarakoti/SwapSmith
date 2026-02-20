CREATE TYPE "public"."mint_status_type" AS ENUM('pending', 'processing', 'minted', 'failed');--> statement-breakpoint
CREATE TYPE "public"."reward_action_type" AS ENUM('course_complete', 'module_complete', 'daily_login', 'swap_complete', 'referral');--> statement-breakpoint
CREATE TABLE "course_progress" (
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
	CONSTRAINT "course_progress_user_course_unique" UNIQUE("user_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "rewards_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"action_type" "reward_action_type" NOT NULL,
	"action_metadata" jsonb,
	"points_earned" integer DEFAULT 0 NOT NULL,
	"tokens_pending" numeric(20, 8) DEFAULT '0' NOT NULL,
	"mint_status" "mint_status_type" DEFAULT 'pending' NOT NULL,
	"tx_hash" text,
	"blockchain_network" text,
	"error_message" text,
	"claimed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stake_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"sideshift_order_id" text NOT NULL,
	"quote_id" text,
	"swap_from_asset" text NOT NULL,
	"swap_from_network" text NOT NULL,
	"swap_from_amount" text NOT NULL,
	"swap_to_asset" text NOT NULL,
	"swap_to_network" text NOT NULL,
	"swap_settle_amount" text,
	"staking_protocol" text NOT NULL,
	"staking_asset" text NOT NULL,
	"staking_network" text NOT NULL,
	"staker_address" text NOT NULL,
	"swap_status" text DEFAULT 'pending' NOT NULL,
	"stake_status" text DEFAULT 'pending' NOT NULL,
	"swap_tx_hash" text,
	"stake_tx_hash" text,
	"estimated_apy" real,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "stake_orders_sideshift_order_id_unique" UNIQUE("sideshift_order_id")
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "telegram_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "firebase_uid" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "total_points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "total_tokens_claimed" numeric(20, 8) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards_log" ADD CONSTRAINT "rewards_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_wallet_address_unique" UNIQUE("wallet_address");