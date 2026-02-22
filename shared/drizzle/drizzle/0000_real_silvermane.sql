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
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"state" text,
	CONSTRAINT "conversations_telegram_id_unique" UNIQUE("telegram_id")
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
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"wallet_address" text,
	"session_topic" text,
	CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id")
);
