-- Migration: Add caching tables
-- Created: 2026-02-13

-- Coin Price Cache Table
CREATE TABLE IF NOT EXISTS coin_price_cache (
  id SERIAL PRIMARY KEY,
  coin TEXT NOT NULL,
  network TEXT NOT NULL,
  name TEXT NOT NULL,
  usd_price TEXT,
  btc_price TEXT,
  available TEXT NOT NULL DEFAULT 'true',
  expires_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(coin, network)
);

-- User Settings Table
CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  wallet_address TEXT,
  theme TEXT DEFAULT 'dark',
  slippage_tolerance REAL DEFAULT 0.5,
  notifications_enabled TEXT DEFAULT 'true',
  default_from_asset TEXT,
  default_to_asset TEXT,
  email_notifications TEXT DEFAULT 'false',
  telegram_notifications TEXT DEFAULT 'false',
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Swap History Table
CREATE TABLE IF NOT EXISTS swap_history (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet_address TEXT,
  sideshift_order_id TEXT NOT NULL,
  quote_id TEXT,
  from_asset TEXT NOT NULL,
  from_network TEXT NOT NULL,
  from_amount REAL NOT NULL,
  to_asset TEXT NOT NULL,
  to_network TEXT NOT NULL,
  settle_amount TEXT NOT NULL,
  deposit_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  tx_hash TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat History Table
CREATE TABLE IF NOT EXISTS chat_history (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet_address TEXT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT,
  session_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_coin_price_cache_coin_network ON coin_price_cache(coin, network);
CREATE INDEX IF NOT EXISTS idx_coin_price_cache_expires_at ON coin_price_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_swap_history_user_id ON swap_history(user_id);
CREATE INDEX IF NOT EXISTS idx_swap_history_wallet_address ON swap_history(wallet_address);
CREATE INDEX IF NOT EXISTS idx_swap_history_created_at ON swap_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_session_id ON chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at DESC);
