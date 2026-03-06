CREATE TYPE "public"."plan_type" AS ENUM('free', 'premium', 'pro');--> statement-breakpoint
CREATE TABLE "plan_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"plan" "plan_type" NOT NULL,
	"coins_spent" integer NOT NULL,
	"duration_days" integer NOT NULL,
	"activated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"telegram_id" bigint,
	"coin" text NOT NULL,
	"network" text NOT NULL,
	"name" text NOT NULL,
	"target_price" numeric(20, 8) NOT NULL,
	"condition" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"triggered_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "watchlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"coin" text NOT NULL,
	"network" text NOT NULL,
	"name" text NOT NULL,
	"added_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan" "plan_type" DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan_purchased_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "daily_chat_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "daily_terminal_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "usage_reset_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "plan_purchases" ADD CONSTRAINT "plan_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_plan_purchases_user_id" ON "plan_purchases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_price_alerts_user_id" ON "price_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_price_alerts_telegram_id" ON "price_alerts" USING btree ("telegram_id");--> statement-breakpoint
CREATE INDEX "idx_price_alerts_is_active" ON "price_alerts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_price_alerts_coin_network" ON "price_alerts" USING btree ("coin","network");--> statement-breakpoint
CREATE INDEX "idx_watchlist_user_id" ON "watchlist" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_watchlist_user_coin_network" ON "watchlist" USING btree ("user_id","coin","network");