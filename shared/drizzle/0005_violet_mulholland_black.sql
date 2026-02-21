ALTER TABLE "limit_orders" ADD COLUMN "condition_operator" text;--> statement-breakpoint
ALTER TABLE "limit_orders" ADD COLUMN "condition_value" real;--> statement-breakpoint
ALTER TABLE "limit_orders" ADD COLUMN "condition_asset" text;--> statement-breakpoint
ALTER TABLE "limit_orders" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "limit_orders" ADD COLUMN "sideshift_order_id" text;--> statement-breakpoint
ALTER TABLE "limit_orders" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "limit_orders" ADD COLUMN "executed_at" timestamp;