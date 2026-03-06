CREATE TABLE "portfolio_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"telegram_id" bigint,
	"name" text DEFAULT 'My Portfolio' NOT NULL,
	"assets" jsonb NOT NULL,
	"drift_threshold" real DEFAULT 5 NOT NULL,
	"auto_rebalance" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_rebalanced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rebalance_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"portfolio_target_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"telegram_id" bigint,
	"trigger_type" text NOT NULL,
	"total_portfolio_value" text NOT NULL,
	"swaps_executed" jsonb NOT NULL,
	"total_fees" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trailing_stop_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"from_asset" text NOT NULL,
	"from_network" text,
	"to_asset" text NOT NULL,
	"to_network" text,
	"from_amount" text NOT NULL,
	"settle_address" text,
	"trailing_percentage" real NOT NULL,
	"peak_price" text,
	"current_price" text,
	"trigger_price" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"triggered_at" timestamp,
	"last_checked_at" timestamp,
	"sideshift_order_id" text,
	"error" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_portfolio_targets_user_id" ON "portfolio_targets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_rebalance_history_user_id" ON "rebalance_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_rebalance_history_target_id" ON "rebalance_history" USING btree ("portfolio_target_id");--> statement-breakpoint
CREATE INDEX "idx_trailing_stop_orders_telegram_id" ON "trailing_stop_orders" USING btree ("telegram_id");