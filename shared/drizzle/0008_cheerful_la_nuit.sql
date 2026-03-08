CREATE TYPE "public"."admin_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."admin_role" AS ENUM('super_admin', 'admin', 'moderator');--> statement-breakpoint
CREATE TABLE "admin_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"firebase_uid" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"reason" text NOT NULL,
	"status" "admin_request_status" DEFAULT 'pending' NOT NULL,
	"approval_token" text NOT NULL,
	"rejection_reason" text,
	"reviewed_at" timestamp,
	"reviewed_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "admin_requests_firebase_uid_unique" UNIQUE("firebase_uid"),
	CONSTRAINT "admin_requests_email_unique" UNIQUE("email"),
	CONSTRAINT "admin_requests_approval_token_unique" UNIQUE("approval_token")
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"firebase_uid" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "admin_role" DEFAULT 'admin' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"approved_at" timestamp,
	"approved_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "admin_users_firebase_uid_unique" UNIQUE("firebase_uid"),
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "batched_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"batch_id" text NOT NULL,
	"transactions" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"target_gas_price" text,
	"max_execution_time" timestamp,
	"executed_at" timestamp,
	"execution_tx_hash" text,
	"gas_saved" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "batched_transactions_batch_id_unique" UNIQUE("batch_id")
);
--> statement-breakpoint
CREATE TABLE "gas_estimates" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain" text NOT NULL,
	"network" text NOT NULL,
	"gas_price" text NOT NULL,
	"gas_price_unit" text DEFAULT 'gwei' NOT NULL,
	"priority_fee" text,
	"base_fee" text,
	"estimated_time_seconds" integer,
	"confidence" real,
	"source" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gas_optimization_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"swap_id" text,
	"original_gas_estimate" text NOT NULL,
	"optimized_gas_estimate" text NOT NULL,
	"gas_token_used" text,
	"gas_saved" text NOT NULL,
	"savings_percent" real NOT NULL,
	"optimization_type" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gas_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"contract_address" text NOT NULL,
	"chain" text NOT NULL,
	"network" text NOT NULL,
	"decimals" integer DEFAULT 18 NOT NULL,
	"token_type" text NOT NULL,
	"discount_percent" real DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "gas_tokens_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "user_gas_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"preferred_gas_token" text,
	"auto_optimize" boolean DEFAULT true NOT NULL,
	"max_gas_price" text,
	"priority_level" text DEFAULT 'medium' NOT NULL,
	"batch_transactions" boolean DEFAULT false NOT NULL,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"custom_settings" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_gas_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "gas_optimization_history" ADD CONSTRAINT "gas_optimization_history_swap_id_swap_history_sideshift_order_id_fk" FOREIGN KEY ("swap_id") REFERENCES "public"."swap_history"("sideshift_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gas_optimization_history" ADD CONSTRAINT "gas_optimization_history_gas_token_used_gas_tokens_symbol_fk" FOREIGN KEY ("gas_token_used") REFERENCES "public"."gas_tokens"("symbol") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_gas_preferences" ADD CONSTRAINT "user_gas_preferences_preferred_gas_token_gas_tokens_symbol_fk" FOREIGN KEY ("preferred_gas_token") REFERENCES "public"."gas_tokens"("symbol") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_admin_requests_email" ON "admin_requests" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_admin_requests_status" ON "admin_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_admin_requests_token" ON "admin_requests" USING btree ("approval_token");--> statement-breakpoint
CREATE INDEX "idx_admin_users_email" ON "admin_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_admin_users_firebase_uid" ON "admin_users" USING btree ("firebase_uid");--> statement-breakpoint
CREATE INDEX "idx_batched_transactions_user_id" ON "batched_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_batched_transactions_status" ON "batched_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_batched_transactions_batch_id" ON "batched_transactions" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_gas_estimates_chain_network" ON "gas_estimates" USING btree ("chain","network");--> statement-breakpoint
CREATE INDEX "idx_gas_estimates_expires" ON "gas_estimates" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_gas_optimization_history_user_id" ON "gas_optimization_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_gas_optimization_history_swap_id" ON "gas_optimization_history" USING btree ("swap_id");--> statement-breakpoint
CREATE INDEX "idx_gas_tokens_symbol" ON "gas_tokens" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_gas_tokens_chain_network" ON "gas_tokens" USING btree ("chain","network");--> statement-breakpoint
CREATE INDEX "idx_user_gas_preferences_user_id" ON "user_gas_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_chat_history_user_id" ON "chat_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_telegram_id" ON "conversations" USING btree ("telegram_id");--> statement-breakpoint
CREATE INDEX "idx_course_progress_user_id" ON "course_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_limit_orders_telegram_id" ON "limit_orders" USING btree ("telegram_id");--> statement-breakpoint
CREATE INDEX "idx_orders_telegram_id" ON "orders" USING btree ("telegram_id");--> statement-breakpoint
CREATE INDEX "idx_rewards_log_user_id" ON "rewards_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_swap_history_user_id" ON "swap_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_settings_user_id" ON "user_settings" USING btree ("user_id");