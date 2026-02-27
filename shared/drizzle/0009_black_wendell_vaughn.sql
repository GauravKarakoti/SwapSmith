CREATE TABLE "followed_traders" (
	"id" serial PRIMARY KEY NOT NULL,
	"follower_id" integer NOT NULL,
	"trader_id" integer NOT NULL,
	"notify_on_portfolio_change" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portfolio_copies" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"portfolio_id" integer NOT NULL,
	"original_trader_id" integer NOT NULL,
	"copied_amount" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portfolio_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"portfolio_id" integer NOT NULL,
	"change_type" text NOT NULL,
	"previous_portfolio" jsonb,
	"new_portfolio" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portfolio_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"trader_id" integer NOT NULL,
	"portfolio_id" integer,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shared_portfolios" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"share_code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"from_asset" text NOT NULL,
	"from_chain" text,
	"portfolio" jsonb NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"copy_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "shared_portfolios_share_code_unique" UNIQUE("share_code")
);
--> statement-breakpoint
CREATE TABLE "trader_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"total_trades" integer DEFAULT 0 NOT NULL,
	"successful_trades" integer DEFAULT 0 NOT NULL,
	"total_volume_usd" text DEFAULT '0' NOT NULL,
	"follower_count" integer DEFAULT 0 NOT NULL,
	"total_copies" integer DEFAULT 0 NOT NULL,
	"average_return" real DEFAULT 0 NOT NULL,
	"win_rate" real DEFAULT 0 NOT NULL,
	"reputation_score" real DEFAULT 0 NOT NULL,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "followed_traders" ADD CONSTRAINT "followed_traders_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followed_traders" ADD CONSTRAINT "followed_traders_trader_id_users_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_copies" ADD CONSTRAINT "portfolio_copies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_copies" ADD CONSTRAINT "portfolio_copies_portfolio_id_shared_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."shared_portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_copies" ADD CONSTRAINT "portfolio_copies_original_trader_id_users_id_fk" FOREIGN KEY ("original_trader_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_history" ADD CONSTRAINT "portfolio_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_history" ADD CONSTRAINT "portfolio_history_portfolio_id_shared_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."shared_portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_notifications" ADD CONSTRAINT "portfolio_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_notifications" ADD CONSTRAINT "portfolio_notifications_trader_id_users_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_notifications" ADD CONSTRAINT "portfolio_notifications_portfolio_id_shared_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."shared_portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_portfolios" ADD CONSTRAINT "shared_portfolios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trader_stats" ADD CONSTRAINT "trader_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_followed_traders_follower_id" ON "followed_traders" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "idx_followed_traders_trader_id" ON "followed_traders" USING btree ("trader_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_copies_user_id" ON "portfolio_copies" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_copies_portfolio_id" ON "portfolio_copies" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_history_portfolio_id" ON "portfolio_history" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_notifications_user_id" ON "portfolio_notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_shared_portfolios_user_id" ON "shared_portfolios" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_shared_portfolios_share_code" ON "shared_portfolios" USING btree ("share_code");--> statement-breakpoint
CREATE INDEX "idx_shared_portfolios_is_public" ON "shared_portfolios" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "idx_trader_stats_user_id" ON "trader_stats" USING btree ("user_id");