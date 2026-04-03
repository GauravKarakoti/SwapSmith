ALTER TABLE "limit_orders" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "limit_orders" ADD COLUMN "retry_after" timestamp;