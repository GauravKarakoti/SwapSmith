-- Add missing indexes for better query performance on frequently filtered columns

-- Orders table: status filtering index (already exists, but ensure it's there)
CREATE INDEX IF NOT EXISTS "idx_orders_status" ON "orders"("status");

-- Checkouts table: add missing status index for filtering
CREATE INDEX IF NOT EXISTS "idx_checkouts_status" ON "checkouts"("status");

-- Limit Orders table: add status and isActive indexes
CREATE INDEX IF NOT EXISTS "idx_limit_orders_status" ON "limit_orders"("status");
CREATE INDEX IF NOT EXISTS "idx_limit_orders_is_active" ON "limit_orders"("is_active");

-- Trailing Stop Orders table: add status and isActive indexes
CREATE INDEX IF NOT EXISTS "idx_trailing_stop_orders_status" ON "trailing_stop_orders"("status");
CREATE INDEX IF NOT EXISTS "idx_trailing_stop_orders_is_active" ON "trailing_stop_orders"("is_active");

-- Portfolio Targets table: add isActive index for filtering active portfolios
CREATE INDEX IF NOT EXISTS "idx_portfolio_targets_is_active" ON "portfolio_targets"("is_active");

-- Rebalance History table: add status index
CREATE INDEX IF NOT EXISTS "idx_rebalance_history_status" ON "rebalance_history"("status");

-- Strategy Subscriptions table: add status index
CREATE INDEX IF NOT EXISTS "idx_strategy_subscriptions_status" ON "strategy_subscriptions"("status");

-- Price Alerts table: add triggeredAt index for unresolved alert queries
CREATE INDEX IF NOT EXISTS "idx_price_alerts_triggered_at" ON "price_alerts"("triggered_at");

-- Swap History table: add status index
CREATE INDEX IF NOT EXISTS "idx_swap_history_status" ON "swap_history"("status");

-- Batched Transactions table: ensure all appropriate indexes exist
CREATE INDEX IF NOT EXISTS "idx_batched_transactions_status" ON "batched_transactions"("status");

-- Users table: add indexes for frequently searched fields
CREATE INDEX IF NOT EXISTS "idx_users_plan" ON "users"("plan");

-- Discussions table: add created_at and category indexes
CREATE INDEX IF NOT EXISTS "idx_discussions_category_created_at" ON "discussions"("category", "created_at");

-- Rewards Log table: add mintStatus index for filtering pending mints
CREATE INDEX IF NOT EXISTS "idx_rewards_log_mint_status" ON "rewards_log"("mint_status");

-- Chat History table: add session_id index for conversation retrieval
CREATE INDEX IF NOT EXISTS "idx_chat_history_session_id" ON "chat_history"("session_id");

-- Coin Gift Logs table: add timestamp index for historical queries
CREATE INDEX IF NOT EXISTS "idx_coin_gift_logs_created_at" ON "coin_gift_logs"("created_at");

-- Gas Tokens table: add isActive index
CREATE INDEX IF NOT EXISTS "idx_gas_tokens_is_active" ON "gas_tokens"("is_active");

-- Admin Requests table: add created_at index for recent requests
CREATE INDEX IF NOT EXISTS "idx_admin_requests_created_at" ON "admin_requests"("created_at");

-- User Settings table: add theme and notification indexes
CREATE INDEX IF NOT EXISTS "idx_user_settings_notifications" ON "user_settings"("notifications_enabled");
