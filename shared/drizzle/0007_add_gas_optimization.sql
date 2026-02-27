-- Migration: Add Gas Fee Optimization & Gas Token Trading Tables
-- Created: 2025-01-24

-- Gas Estimates Table (for caching real-time gas prices)
CREATE TABLE IF NOT EXISTS gas_estimates (
    id SERIAL PRIMARY KEY,
    chain TEXT NOT NULL,
    network TEXT NOT NULL,
    gas_price TEXT NOT NULL,
    gas_price_unit TEXT NOT NULL DEFAULT 'gwei',
    priority_fee TEXT,
    base_fee TEXT,
    estimated_time_seconds INTEGER,
    confidence REAL,
    source TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_gas_estimates_chain_network ON gas_estimates(chain, network);
CREATE INDEX idx_gas_estimates_expires ON gas_estimates(expires_at);

-- Gas Tokens Table (supported gas tokens like CHI, GST)
CREATE TABLE IF NOT EXISTS gas_tokens (
    id SERIAL PRIMARY KEY,
    symbol TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    contract_address TEXT NOT NULL,
    chain TEXT NOT NULL,
    network TEXT NOT NULL,
    decimals INTEGER NOT NULL DEFAULT 18,
    token_type TEXT NOT NULL,
    discount_percent REAL NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_gas_tokens_symbol ON gas_tokens(symbol);
CREATE INDEX idx_gas_tokens_chain_network ON gas_tokens(chain, network);

-- User Gas Preferences Table
CREATE TABLE IF NOT EXISTS user_gas_preferences (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    preferred_gas_token TEXT REFERENCES gas_tokens(symbol),
    auto_optimize BOOLEAN NOT NULL DEFAULT true,
    max_gas_price TEXT,
    priority_level TEXT NOT NULL DEFAULT 'medium',
    batch_transactions BOOLEAN NOT NULL DEFAULT false,
    notifications_enabled BOOLEAN NOT NULL DEFAULT true,
    custom_settings JSONB,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_gas_preferences_user_id ON user_gas_preferences(user_id);

-- Batched Transactions Table
CREATE TABLE IF NOT EXISTS batched_transactions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    batch_id TEXT NOT NULL UNIQUE,
    transactions JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    target_gas_price TEXT,
    max_execution_time TIMESTAMP,
    executed_at TIMESTAMP,
    execution_tx_hash TEXT,
    gas_saved TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_batched_transactions_user_id ON batched_transactions(user_id);
CREATE INDEX idx_batched_transactions_status ON batched_transactions(status);
CREATE INDEX idx_batched_transactions_batch_id ON batched_transactions(batch_id);

-- Gas Optimization History Table
CREATE TABLE IF NOT EXISTS gas_optimization_history (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    swap_id TEXT REFERENCES swap_history(sideshift_order_id),
    original_gas_estimate TEXT NOT NULL,
    optimized_gas_estimate TEXT NOT NULL,
    gas_token_used TEXT REFERENCES gas_tokens(symbol),
    gas_saved TEXT NOT NULL,
    savings_percent REAL NOT NULL,
    optimization_type TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_gas_optimization_history_user_id ON gas_optimization_history(user_id);
CREATE INDEX idx_gas_optimization_history_swap_id ON gas_optimization_history(swap_id);

-- Insert default gas tokens
INSERT INTO gas_tokens (symbol, name, contract_address, chain, network, decimals, token_type, discount_percent, is_active, metadata) VALUES
('CHI', 'Chi Gastoken', '0x0000000000004946c0e9F43F4Dee607b0eF1fA1c', 'ethereum', 'mainnet', 0, 'chi', 42.0, true, '{"description": "1inch Gas Token for Ethereum mainnet", "website": "https://1inch.io"}'),
('GST', 'Gas Station Token', '0x0000000000000000000000000000000000000000', 'ethereum', 'mainnet', 18, 'gst', 35.0, true, '{"description": "Generic gas station token", "website": ""}'),
('MATIC-GST', 'Polygon Gas Token', '0x0000000000000000000000000000000000000000', 'polygon', 'mainnet', 18, 'custom', 30.0, true, '{"description": "Polygon native gas token", "website": ""}'),
('BSC-GST', 'BSC Gas Token', '0x0000000000000000000000000000000000000000', 'bsc', 'mainnet', 18, 'custom', 25.0, true, '{"description": "BSC gas optimization token", "website": ""}')
ON CONFLICT (symbol) DO NOTHING;
