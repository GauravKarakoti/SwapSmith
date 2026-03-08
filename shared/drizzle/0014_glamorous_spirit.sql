CREATE TABLE "groq_usage_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"model" text NOT NULL,
	"endpoint" text DEFAULT 'chat' NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"page" text NOT NULL,
	"user_id" text,
	"session_id" text,
	"user_agent" text,
	"referer" text,
	"visited_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "strategy_subscriptions" DROP CONSTRAINT "strategy_subscriptions_strategy_id_subscriber_id_unique";--> statement-breakpoint
DROP INDEX "idx_strategy_performance_strategy";--> statement-breakpoint
DROP INDEX "idx_strategy_subscriptions_subscriber";--> statement-breakpoint
DROP INDEX "idx_strategy_trades_strategy";--> statement-breakpoint
DROP INDEX "idx_trading_strategies_creator";--> statement-breakpoint
DROP INDEX "idx_trading_strategies_status";--> statement-breakpoint
ALTER TABLE "trading_strategies" ALTER COLUMN "is_public" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "trading_strategies" ALTER COLUMN "updated_at" DROP DEFAULT;--> statement-breakpoint
CREATE INDEX "idx_groq_usage_logs_user_id" ON "groq_usage_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_groq_usage_logs_model" ON "groq_usage_logs" USING btree ("model");--> statement-breakpoint
CREATE INDEX "idx_groq_usage_logs_created_at" ON "groq_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_page_visits_page" ON "page_visits" USING btree ("page");--> statement-breakpoint
CREATE INDEX "idx_page_visits_user_id" ON "page_visits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_page_visits_visited_at" ON "page_visits" USING btree ("visited_at");--> statement-breakpoint
CREATE INDEX "idx_chat_history_session_id" ON "chat_history" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_limit_orders_status" ON "limit_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_limit_orders_is_active" ON "limit_orders" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_rebalance_history_status" ON "rebalance_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_rewards_log_mint_status" ON "rewards_log" USING btree ("mint_status");--> statement-breakpoint
CREATE INDEX "idx_strategy_performance_strategy_id" ON "strategy_performance" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "idx_strategy_subscriptions_strategy_id" ON "strategy_subscriptions" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "idx_strategy_subscriptions_subscriber_id" ON "strategy_subscriptions" USING btree ("subscriber_id");--> statement-breakpoint
CREATE INDEX "idx_strategy_trades_strategy_id" ON "strategy_trades" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "idx_swap_history_status" ON "swap_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_trailing_stop_orders_status" ON "trailing_stop_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_trailing_stop_orders_is_active" ON "trailing_stop_orders" USING btree ("is_active");--> statement-breakpoint
ALTER TABLE "strategy_performance" DROP COLUMN "pnl";--> statement-breakpoint
ALTER TABLE "trading_strategies" DROP COLUMN "sharpe_ratio";--> statement-breakpoint
ALTER TABLE "trading_strategies" DROP COLUMN "volatility";