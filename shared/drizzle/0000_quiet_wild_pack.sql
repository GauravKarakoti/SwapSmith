CREATE TABLE "address_book" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"label" text NOT NULL,
	"address" text NOT NULL,
	"chain" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"wallet_address" text,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" text,
	"session_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "checkouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"checkout_id" text NOT NULL,
	"settle_asset" text NOT NULL,
	"settle_network" text NOT NULL,
	"settle_amount" real NOT NULL,
	"settle_address" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "checkouts_checkout_id_unique" UNIQUE("checkout_id")
);
--> statement-breakpoint
CREATE TABLE "coin_price_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"coin" text NOT NULL,
	"network" text NOT NULL,
	"name" text NOT NULL,
	"usd_price" text,
	"btc_price" text,
	"available" text DEFAULT 'true' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "coin_price_cache_coin_network_unique" UNIQUE("coin","network")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"state" text,
	"last_updated" timestamp,
	CONSTRAINT "conversations_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
CREATE TABLE "dca_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"from_asset" text NOT NULL,
	"from_network" text NOT NULL,
	"to_asset" text NOT NULL,
	"to_network" text NOT NULL,
	"amount_per_order" text NOT NULL,
	"interval_hours" integer NOT NULL,
	"total_orders" integer NOT NULL,
	"orders_executed" integer DEFAULT 0 NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"next_execution_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "discussions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"username" text NOT NULL,
	"content" text NOT NULL,
	"category" text DEFAULT 'general',
	"likes" text DEFAULT '0',
	"replies" text DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "limit_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"from_asset" text NOT NULL,
	"from_network" text NOT NULL,
	"to_asset" text NOT NULL,
	"to_network" text NOT NULL,
	"from_amount" text NOT NULL,
	"target_price" text NOT NULL,
	"current_price" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"last_checked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"sideshift_order_id" text NOT NULL,
	"quote_id" text,
	"from_asset" text NOT NULL,
	"from_network" text NOT NULL,
	"from_amount" text NOT NULL,
	"to_asset" text NOT NULL,
	"to_network" text NOT NULL,
	"settle_amount" text NOT NULL,
	"deposit_address" text NOT NULL,
	"deposit_memo" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"tx_hash" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "orders_sideshift_order_id_unique" UNIQUE("sideshift_order_id")
);
--> statement-breakpoint
CREATE TABLE "swap_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"wallet_address" text,
	"sideshift_order_id" text NOT NULL,
	"quote_id" text,
	"from_asset" text NOT NULL,
	"from_network" text NOT NULL,
	"from_amount" real NOT NULL,
	"to_asset" text NOT NULL,
	"to_network" text NOT NULL,
	"settle_amount" text NOT NULL,
	"deposit_address" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"tx_hash" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	CONSTRAINT "swap_history_sideshift_order_id_unique" UNIQUE("sideshift_order_id")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"wallet_address" text,
	"theme" text,
	"slippage_tolerance" real,
	"notifications_enabled" text,
	"preferences" text,
	"email_notifications" text,
	"telegram_notifications" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"wallet_address" text,
	"session_topic" text,
	CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
CREATE TABLE "watched_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"sideshift_order_id" text NOT NULL,
	"last_status" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "watched_orders_sideshift_order_id_unique" UNIQUE("sideshift_order_id")
);
