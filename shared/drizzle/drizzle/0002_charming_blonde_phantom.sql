CREATE TABLE "address_book" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"nickname" text NOT NULL,
	"address" text NOT NULL,
	"chain" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
