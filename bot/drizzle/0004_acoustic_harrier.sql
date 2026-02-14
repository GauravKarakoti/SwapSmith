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
