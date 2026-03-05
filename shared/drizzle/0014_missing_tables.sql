-- Migration 0014: Create all missing tables and types
-- Uses IF NOT EXISTS throughout for safe re-runs

-- ─── MISSING ENUM TYPES ───────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "public"."strategy_risk_level" AS ENUM('low', 'medium', 'high', 'aggressive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."strategy_status" AS ENUM('active', 'paused', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."subscription_status" AS ENUM('active', 'paused', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."trade_status" AS ENUM('pending', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."performance_status" AS ENUM('pending', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."coin_gift_action_type" AS ENUM('gift', 'deduct', 'reset');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add missing values to existing reward_action_type enum
ALTER TYPE "public"."reward_action_type" ADD VALUE IF NOT EXISTS 'wallet_connected';
ALTER TYPE "public"."reward_action_type" ADD VALUE IF NOT EXISTS 'terminal_used';
ALTER TYPE "public"."reward_action_type" ADD VALUE IF NOT EXISTS 'notification_enabled';

-- ─── MISSING TABLES ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "limit_orders" (
  "id" serial PRIMARY KEY NOT NULL,
  "telegram_id" bigint NOT NULL,
  "from_asset" text NOT NULL,
  "from_network" text NOT NULL,
  "to_asset" text NOT NULL,
  "to_network" text NOT NULL,
  "from_amount" text NOT NULL,
  "target_price" text NOT NULL,
  "current_price" text,
  "is_active" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "last_checked_at" timestamp,
  "condition_operator" text,
  "condition_value" real,
  "condition_asset" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "sideshift_order_id" text,
  "error" text,
  "executed_at" timestamp
);

CREATE TABLE IF NOT EXISTS "trailing_stop_orders" (
  "id" serial PRIMARY KEY NOT NULL,
  "telegram_id" bigint NOT NULL,
  "from_asset" text NOT NULL,
  "from_network" text,
  "to_asset" text NOT NULL,
  "to_network" text,
  "from_amount" text NOT NULL,
  "settle_address" text,
  "trailing_percentage" real NOT NULL,
  "peak_price" text,
  "current_price" text,
  "trigger_price" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "triggered_at" timestamp,
  "last_checked_at" timestamp,
  "sideshift_order_id" text,
  "error" text,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "portfolio_targets" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "telegram_id" bigint,
  "name" text DEFAULT 'My Portfolio' NOT NULL,
  "assets" jsonb NOT NULL,
  "drift_threshold" real DEFAULT 5 NOT NULL,
  "auto_rebalance" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "last_rebalanced_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "rebalance_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "portfolio_target_id" integer NOT NULL,
  "user_id" text NOT NULL,
  "telegram_id" bigint,
  "trigger_type" text NOT NULL,
  "total_portfolio_value" text NOT NULL,
  "swaps_executed" jsonb NOT NULL,
  "total_fees" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "watchlist" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "coin" text NOT NULL,
  "network" text NOT NULL,
  "name" text NOT NULL,
  "added_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "price_alerts" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "telegram_id" bigint,
  "coin" text NOT NULL,
  "network" text NOT NULL,
  "name" text NOT NULL,
  "target_price" numeric(20, 8) NOT NULL,
  "condition" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "triggered_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "coin_gift_logs" (
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
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "coin_gift_logs_target_user_id_users_id_fk"
    FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "trading_strategies" (
  "id" serial PRIMARY KEY NOT NULL,
  "creator_id" integer NOT NULL,
  "creator_telegram_id" bigint,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "parameters" jsonb NOT NULL,
  "risk_level" "strategy_risk_level" NOT NULL,
  "subscription_fee" numeric(20, 2) NOT NULL,
  "performance_fee" real DEFAULT 0 NOT NULL,
  "min_investment" numeric(20, 2) NOT NULL,
  "is_public" boolean DEFAULT false NOT NULL,
  "tags" jsonb DEFAULT '[]',
  "status" "strategy_status" DEFAULT 'active' NOT NULL,
  "subscriber_count" integer DEFAULT 0 NOT NULL,
  "total_trades" integer DEFAULT 0 NOT NULL,
  "successful_trades" integer DEFAULT 0 NOT NULL,
  "total_return" numeric(20, 2) DEFAULT '0',
  "monthly_return" numeric(20, 2) DEFAULT '0',
  "max_drawdown" numeric(20, 2) DEFAULT '0',
  "volatility" numeric(20, 2) DEFAULT '0',
  "sharpe_ratio" numeric(20, 2) DEFAULT '0',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "trading_strategies_creator_id_users_id_fk"
    FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "strategy_subscriptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "strategy_id" integer NOT NULL,
  "subscriber_id" integer NOT NULL,
  "subscriber_telegram_id" bigint,
  "subscription_fee" numeric(20, 2) NOT NULL,
  "allocation_percent" integer DEFAULT 100 NOT NULL,
  "auto_rebalance" boolean DEFAULT true NOT NULL,
  "stop_loss_percent" numeric(5, 2),
  "status" "subscription_status" DEFAULT 'active' NOT NULL,
  "joined_at" timestamp DEFAULT now() NOT NULL,
  "paused_at" timestamp,
  "cancelled_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "strategy_subscriptions_strategy_id_trading_strategies_id_fk"
    FOREIGN KEY ("strategy_id") REFERENCES "public"."trading_strategies"("id") ON DELETE CASCADE,
  CONSTRAINT "strategy_subscriptions_subscriber_id_users_id_fk"
    FOREIGN KEY ("subscriber_id") REFERENCES "public"."users"("id") ON DELETE CASCADE,
  CONSTRAINT "idx_strategy_subscriptions_unique"
    UNIQUE ("strategy_id", "subscriber_id")
);

CREATE TABLE IF NOT EXISTS "strategy_trades" (
  "id" serial PRIMARY KEY NOT NULL,
  "strategy_id" integer NOT NULL,
  "from_token" text NOT NULL,
  "to_token" text NOT NULL,
  "swap_amount" numeric(20, 8) NOT NULL,
  "settle_amount" numeric(20, 8),
  "sideshift_order_id" text,
  "status" "trade_status" DEFAULT 'pending' NOT NULL,
  "error" text,
  "executed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "strategy_trades_strategy_id_trading_strategies_id_fk"
    FOREIGN KEY ("strategy_id") REFERENCES "public"."trading_strategies"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "strategy_performance" (
  "id" serial PRIMARY KEY NOT NULL,
  "strategy_id" integer NOT NULL,
  "pnl" numeric(20, 8) NOT NULL,
  "pnl_percent" numeric(20, 2) NOT NULL,
  "status" "performance_status" DEFAULT 'pending' NOT NULL,
  "executed_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "strategy_performance_strategy_id_trading_strategies_id_fk"
    FOREIGN KEY ("strategy_id") REFERENCES "public"."trading_strategies"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "gas_estimates" (
  "id" serial PRIMARY KEY NOT NULL,
  "chain" text NOT NULL,
  "network" text NOT NULL,
  "gas_price" text NOT NULL,
  "gas_price_unit" text DEFAULT 'gwei' NOT NULL,
  "priority_fee" text,
  "base_fee" text,
  "estimated_time_seconds" integer,
  "confidence" real,
  "source" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "gas_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "symbol" text NOT NULL,
  "name" text NOT NULL,
  "contract_address" text NOT NULL,
  "chain" text NOT NULL,
  "network" text NOT NULL,
  "decimals" integer DEFAULT 18 NOT NULL,
  "token_type" text NOT NULL,
  "discount_percent" real DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "gas_tokens_symbol_unique" UNIQUE ("symbol")
);

CREATE TABLE IF NOT EXISTS "user_gas_preferences" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "preferred_gas_token" text,
  "auto_optimize" boolean DEFAULT true NOT NULL,
  "max_gas_price" text,
  "priority_level" text DEFAULT 'medium' NOT NULL,
  "batch_transactions" boolean DEFAULT false NOT NULL,
  "notifications_enabled" boolean DEFAULT true NOT NULL,
  "custom_settings" jsonb,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "user_gas_preferences_user_id_unique" UNIQUE ("user_id"),
  CONSTRAINT "user_gas_preferences_preferred_gas_token_gas_tokens_symbol_fk"
    FOREIGN KEY ("preferred_gas_token") REFERENCES "public"."gas_tokens"("symbol")
);

CREATE TABLE IF NOT EXISTS "batched_transactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "batch_id" text NOT NULL,
  "transactions" jsonb NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "target_gas_price" text,
  "max_execution_time" timestamp,
  "executed_at" timestamp,
  "execution_tx_hash" text,
  "gas_saved" text,
  "error_message" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "batched_transactions_batch_id_unique" UNIQUE ("batch_id")
);

CREATE TABLE IF NOT EXISTS "gas_optimization_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "swap_id" text,
  "original_gas_estimate" text NOT NULL,
  "optimized_gas_estimate" text NOT NULL,
  "gas_token_used" text,
  "gas_saved" text NOT NULL,
  "savings_percent" real NOT NULL,
  "optimization_type" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now()
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "idx_limit_orders_telegram_id" ON "limit_orders" ("telegram_id");
CREATE INDEX IF NOT EXISTS "idx_limit_orders_status" ON "limit_orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_limit_orders_is_active" ON "limit_orders" ("is_active");

CREATE INDEX IF NOT EXISTS "idx_trailing_stop_orders_telegram_id" ON "trailing_stop_orders" ("telegram_id");
CREATE INDEX IF NOT EXISTS "idx_trailing_stop_orders_status" ON "trailing_stop_orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_trailing_stop_orders_is_active" ON "trailing_stop_orders" ("is_active");

CREATE INDEX IF NOT EXISTS "idx_portfolio_targets_user_id" ON "portfolio_targets" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_portfolio_targets_is_active" ON "portfolio_targets" ("is_active");

CREATE INDEX IF NOT EXISTS "idx_rebalance_history_user_id" ON "rebalance_history" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_rebalance_history_target_id" ON "rebalance_history" ("portfolio_target_id");
CREATE INDEX IF NOT EXISTS "idx_rebalance_history_status" ON "rebalance_history" ("status");

CREATE INDEX IF NOT EXISTS "idx_watchlist_user_id" ON "watchlist" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_watchlist_user_coin_network" ON "watchlist" ("user_id", "coin", "network");

CREATE INDEX IF NOT EXISTS "idx_price_alerts_user_id" ON "price_alerts" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_price_alerts_telegram_id" ON "price_alerts" ("telegram_id");
CREATE INDEX IF NOT EXISTS "idx_price_alerts_is_active" ON "price_alerts" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_price_alerts_coin_network" ON "price_alerts" ("coin", "network");
CREATE INDEX IF NOT EXISTS "idx_price_alerts_triggered_at" ON "price_alerts" ("triggered_at");

CREATE INDEX IF NOT EXISTS "idx_coin_gift_logs_target_user" ON "coin_gift_logs" ("target_user_id");
CREATE INDEX IF NOT EXISTS "idx_coin_gift_logs_admin" ON "coin_gift_logs" ("admin_id");
CREATE INDEX IF NOT EXISTS "idx_coin_gift_logs_created_at" ON "coin_gift_logs" ("created_at");

CREATE INDEX IF NOT EXISTS "idx_trading_strategies_creator_id" ON "trading_strategies" ("creator_id");
CREATE INDEX IF NOT EXISTS "idx_trading_strategies_status" ON "trading_strategies" ("status");
CREATE INDEX IF NOT EXISTS "idx_trading_strategies_is_public" ON "trading_strategies" ("is_public");
CREATE INDEX IF NOT EXISTS "idx_trading_strategies_created_at" ON "trading_strategies" ("created_at");

CREATE INDEX IF NOT EXISTS "idx_strategy_subscriptions_strategy_id" ON "strategy_subscriptions" ("strategy_id");
CREATE INDEX IF NOT EXISTS "idx_strategy_subscriptions_subscriber_id" ON "strategy_subscriptions" ("subscriber_id");
CREATE INDEX IF NOT EXISTS "idx_strategy_subscriptions_status" ON "strategy_subscriptions" ("status");

CREATE INDEX IF NOT EXISTS "idx_strategy_trades_strategy_id" ON "strategy_trades" ("strategy_id");
CREATE INDEX IF NOT EXISTS "idx_strategy_trades_status" ON "strategy_trades" ("status");
CREATE INDEX IF NOT EXISTS "idx_strategy_trades_created_at" ON "strategy_trades" ("created_at");

CREATE INDEX IF NOT EXISTS "idx_strategy_performance_strategy_id" ON "strategy_performance" ("strategy_id");
CREATE INDEX IF NOT EXISTS "idx_strategy_performance_executed_at" ON "strategy_performance" ("executed_at");

CREATE INDEX IF NOT EXISTS "idx_gas_estimates_chain_network" ON "gas_estimates" ("chain", "network");
CREATE INDEX IF NOT EXISTS "idx_gas_estimates_expires" ON "gas_estimates" ("expires_at");

CREATE INDEX IF NOT EXISTS "idx_gas_tokens_symbol" ON "gas_tokens" ("symbol");
CREATE INDEX IF NOT EXISTS "idx_gas_tokens_chain_network" ON "gas_tokens" ("chain", "network");
CREATE INDEX IF NOT EXISTS "idx_gas_tokens_is_active" ON "gas_tokens" ("is_active");

CREATE INDEX IF NOT EXISTS "idx_user_gas_preferences_user_id" ON "user_gas_preferences" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_batched_transactions_user_id" ON "batched_transactions" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_batched_transactions_status" ON "batched_transactions" ("status");
CREATE INDEX IF NOT EXISTS "idx_batched_transactions_batch_id" ON "batched_transactions" ("batch_id");

CREATE INDEX IF NOT EXISTS "idx_gas_optimization_history_user_id" ON "gas_optimization_history" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_gas_optimization_history_swap_id" ON "gas_optimization_history" ("swap_id");

-- Also add any missing indexes on existing tables
CREATE INDEX IF NOT EXISTS "idx_admin_requests_created_at" ON "admin_requests" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_swap_history_status" ON "swap_history" ("status");
