-- Migration: Add stakeOrders table for Swap and Stake feature
-- This table tracks orders that combine a SideShift swap with a subsequent staking operation

CREATE TABLE IF NOT EXISTS stake_orders (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  sideshift_order_id TEXT NOT NULL UNIQUE,
  quote_id TEXT,
  
  -- Swap phase fields
  swap_from_asset TEXT NOT NULL,
  swap_from_network TEXT NOT NULL,
  swap_from_amount TEXT NOT NULL,
  swap_to_asset TEXT NOT NULL,
  swap_to_network TEXT NOT NULL,
  swap_settle_amount TEXT,
  
  -- Staking phase fields
  staking_protocol TEXT NOT NULL,  -- e.g., 'Lido', 'RocketPool', 'Frax', 'Stader'
  staking_asset TEXT NOT NULL,
  staking_network TEXT NOT NULL,
  staker_address TEXT NOT NULL,
  
  -- Status tracking
  swap_status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, settled, failed
  stake_status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, staked, failed
  swap_tx_hash TEXT,
  stake_tx_hash TEXT,
  
  -- Yield info
  estimated_apy REAL,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_stake_orders_sideshift_id ON stake_orders(sideshift_order_id);
CREATE INDEX IF NOT EXISTS idx_stake_orders_telegram_id ON stake_orders(telegram_id);
CREATE INDEX IF NOT EXISTS idx_stake_orders_status ON stake_orders(swap_status, stake_status);
