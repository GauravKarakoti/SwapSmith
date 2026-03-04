CREATE TYPE "public"."coin_gift_action_type" AS ENUM('gift', 'deduct', 'reset');--> statement-breakpoint
CREATE TABLE "coin_gift_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" text NOT NULL,
	"admin_email" text NOT NULL,
	"target_user_id" integer NOT NULL,
	"wallet_address" text,
	"action" "coin_gift_action_type" NOT NULL,
	"amount" numeric(20, 2) NOT NULL,
	"balance_before" numeric(20, 2) DEFAULT '0' NOT NULL,
	"balance_after" numeric(20, 2) DEFAULT '0' NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coin_gift_logs" ADD CONSTRAINT "coin_gift_logs_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_coin_gift_logs_target_user" ON "coin_gift_logs" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "idx_coin_gift_logs_admin" ON "coin_gift_logs" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "idx_coin_gift_logs_created_at" ON "coin_gift_logs" USING btree ("created_at");