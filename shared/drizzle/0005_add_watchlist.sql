CREATE TABLE "watchlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"coin" text NOT NULL,
	"network" text NOT NULL,
	"name" text NOT NULL,
	"added_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_watchlist_user_id" ON "watchlist" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_watchlist_user_coin_network" ON "watchlist" USING btree ("user_id", "coin", "network");
