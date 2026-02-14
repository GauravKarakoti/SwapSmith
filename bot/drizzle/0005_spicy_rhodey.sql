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
	"status" text DEFAULT 'pending' NOT NULL,
	"sideshift_order_id" text,
	"error" text,
	"created_at" timestamp DEFAULT now(),
	"executed_at" timestamp
);
