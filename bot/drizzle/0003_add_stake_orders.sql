-- Migration: Add stake_orders table for swap-and-stake compound actions
-- Created: 2024

-- Create stake_orders table to track swap-and-stake operations
CREATE TABLE IF NOT EXISTS stake_orders (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    sideshift_order_id TEXT NOT NULL UNIQUE,
    quote_id TEXT NOT NULL,
    from_asset TEXT NOT NULL,
    from_network TEXT NOT NULL,
    from_amount REAL NOT NULL,
    swap_to_asset TEXT NOT NULL,
    swap_to_network TEXT NOT NULL,
    stake_asset TEXT NOT NULL,
    stake_protocol TEXT NOT NULL,
    stake_network TEXT NOT NULL,
    settle_amount TEXT,
    deposit_address TEXT NOT NULL,
    deposit_memo TEXT,
    stake_address TEXT,
    stake_tx_hash TEXT,
    swap_status TEXT NOT NULL DEFAULT 'pending',
    stake_status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Create index on telegram_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_stake_orders_telegram_id ON stake_orders(telegram_id);

-- Create index on swap_status for monitoring pending swaps
CREATE INDEX IF NOT EXISTS idx_stake_orders_swap_status ON stake_orders(swap_status);

-- Create index on stake_status for monitoring pending stakes
CREATE INDEX IF NOT EXISTS idx_stake_orders_stake_status ON stake_orders(stake_status);

-- Add comment for documentation
COMMENT ON TABLE stake_orders IS 'Tracks compound swap-and-stake operations where users swap assets and then stake the received tokens';
