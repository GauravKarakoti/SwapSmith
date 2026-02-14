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
