-- Create watched_orders table for persistent transaction monitoring
CREATE TABLE IF NOT EXISTS "watched_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"sideshift_order_id" text NOT NULL,
	"last_status" text DEFAULT 'pending' NOT NULL,
	"last_checked" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "watched_orders_sideshift_order_id_unique" UNIQUE("sideshift_order_id")
);
