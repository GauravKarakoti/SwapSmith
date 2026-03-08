CREATE TYPE "public"."performance_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."strategy_risk_level" AS ENUM('low', 'medium', 'high', 'aggressive');--> statement-breakpoint
CREATE TYPE "public"."strategy_status" AS ENUM('active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'paused', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."trade_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
ALTER TABLE "strategy_performance" ALTER COLUMN "executed_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "strategy_subscriptions" ALTER COLUMN "subscription_fee" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "strategy_subscriptions" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."subscription_status";--> statement-breakpoint
ALTER TABLE "strategy_subscriptions" ALTER COLUMN "status" SET DATA TYPE "public"."subscription_status" USING "status"::"public"."subscription_status";--> statement-breakpoint
ALTER TABLE "trading_strategies" ALTER COLUMN "risk_level" SET DEFAULT 'medium'::"public"."strategy_risk_level";--> statement-breakpoint
ALTER TABLE "trading_strategies" ALTER COLUMN "risk_level" SET DATA TYPE "public"."strategy_risk_level" USING "risk_level"::"public"."strategy_risk_level";--> statement-breakpoint
ALTER TABLE "trading_strategies" ALTER COLUMN "subscription_fee" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "trading_strategies" ALTER COLUMN "performance_fee" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "trading_strategies" ALTER COLUMN "min_investment" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "trading_strategies" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."strategy_status";--> statement-breakpoint
ALTER TABLE "trading_strategies" ALTER COLUMN "status" SET DATA TYPE "public"."strategy_status" USING "status"::"public"."strategy_status";--> statement-breakpoint
ALTER TABLE "trading_strategies" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "strategy_performance" ADD COLUMN "pnl" numeric(20, 8) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "strategy_trades" ADD COLUMN "from_asset" text NOT NULL;--> statement-breakpoint
ALTER TABLE "strategy_trades" ADD COLUMN "from_network" text NOT NULL;--> statement-breakpoint
ALTER TABLE "strategy_trades" ADD COLUMN "from_amount" text NOT NULL;--> statement-breakpoint
ALTER TABLE "strategy_trades" ADD COLUMN "to_asset" text NOT NULL;--> statement-breakpoint
ALTER TABLE "strategy_trades" ADD COLUMN "to_network" text NOT NULL;--> statement-breakpoint
ALTER TABLE "trading_strategies" ADD COLUMN "volatility" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "trading_strategies" ADD COLUMN "sharpe_ratio" real DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_admin_requests_created_at" ON "admin_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_checkouts_status" ON "checkouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_gas_tokens_is_active" ON "gas_tokens" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_portfolio_targets_is_active" ON "portfolio_targets" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_price_alerts_triggered_at" ON "price_alerts" USING btree ("triggered_at");--> statement-breakpoint
CREATE INDEX "idx_strategy_performance_executed_at" ON "strategy_performance" USING btree ("executed_at");--> statement-breakpoint
CREATE INDEX "idx_trading_strategies_creator_id" ON "trading_strategies" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "idx_trading_strategies_status" ON "trading_strategies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_trading_strategies_is_public" ON "trading_strategies" USING btree ("is_public");--> statement-breakpoint
ALTER TABLE "strategy_subscriptions" ADD CONSTRAINT "unique_subscription" UNIQUE("strategy_id","subscriber_id");