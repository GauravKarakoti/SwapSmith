CREATE TABLE "address_book" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"nickname" text NOT NULL,
	"address" text NOT NULL,
	"chain" text NOT NULL,
	"created_at" timestamp DEFAULT now()
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
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"state" text,
	"last_updated" timestamp DEFAULT now(),
	CONSTRAINT "conversations_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
CREATE TABLE "dca_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"from_asset" text NOT NULL,
	"from_chain" text NOT NULL,
	"to_asset" text NOT NULL,
	"to_chain" text NOT NULL,
	"amount" real NOT NULL,
	"frequency" text NOT NULL,
	"day_of_week" text,
	"day_of_month" text,
	"settle_address" text NOT NULL,
	"is_active" text DEFAULT 'true' NOT NULL,
	"last_executed" timestamp,
	"next_execution" timestamp NOT NULL,
	"execution_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "limit_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"from_asset" text NOT NULL,
	"from_chain" text NOT NULL,
	"to_asset" text NOT NULL,
	"to_chain" text NOT NULL,
	"amount" real NOT NULL,
	"condition_operator" text NOT NULL,
	"condition_value" real NOT NULL,
	"condition_asset" text NOT NULL,
	"settle_address" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"sideshift_order_id" text,
	"error" text,
	"created_at" timestamp DEFAULT now(),
	"executed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"sideshift_order_id" text NOT NULL,
	"quote_id" text NOT NULL,
	"from_asset" text NOT NULL,
	"from_network" text NOT NULL,
	"from_amount" real NOT NULL,
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
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"wallet_address" text,
	"theme" text DEFAULT 'dark',
	"slippage_tolerance" real DEFAULT 0.5,
	"notifications_enabled" text DEFAULT 'true',
	"default_from_asset" text,
	"default_to_asset" text,
	"preferences" text,
	"email_notifications" text,
	"telegram_notifications" text DEFAULT 'false',
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
	"last_status" text DEFAULT 'pending' NOT NULL,
	"last_checked" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "watched_orders_sideshift_order_id_unique" UNIQUE("sideshift_order_id")
);
