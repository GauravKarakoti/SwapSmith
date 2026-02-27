-- Migration: Add Trailing Stop Orders Table
-- Created: 2025-01-24

-- Trailing Stop Orders Table
CREATE TABLE IF NOT EXISTS trailing_stop_orders (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT,
    user_id TEXT,
    from_asset TEXT NOT NULL,
    from_network TEXT NOT NULL,
    to_asset TEXT NOT NULL,
    to_network TEXT NOT NULL,
    from_amount TEXT NOT NULL,
    trailing_percentage REAL NOT NULL,
    peak_price NUMERIC(20, 8),
    current_price NUMERIC(20, 8),
    trigger_price NUMERIC(20, 8),
    is_active BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'pending',
    settle_address TEXT,
    sideshift_order_id TEXT,
    error TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    last_checked_at TIMESTAMP,
    triggered_at TIMESTAMP,
    expires_at TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX idx_trailing_stop_orders_telegram_id ON trailing_stop_orders(telegram_id);
CREATE INDEX idx_trailing_stop_orders_user_id ON trailing_stop_orders(user_id);
CREATE INDEX idx_trailing_stop_orders_is_active ON trailing_stop_orders(is_active);
CREATE INDEX idx_trailing_stop_orders_status ON trailing_stop_orders(status);
CREATE INDEX idx_trailing_stop_orders_created_at ON trailing_stop_orders(created_at);
