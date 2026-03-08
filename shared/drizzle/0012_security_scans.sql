-- Security Scans Table
-- Stores transaction security scan results

CREATE TABLE IF NOT EXISTS security_scans (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet_address TEXT,
  -- Transaction details
  from_token TEXT NOT NULL,
  from_network TEXT NOT NULL,
  to_token TEXT NOT NULL,
  to_network TEXT NOT NULL,
  from_amount TEXT NOT NULL,
  contract_address TEXT,
  -- Risk assessment
  risk_score INTEGER NOT NULL DEFAULT 0, -- 0-100 risk score
  risk_level TEXT NOT NULL DEFAULT 'unknown', -- 'safe', 'low', 'medium', 'high', 'critical'
  -- Security checks (JSON)
  checks JSONB NOT NULL DEFAULT '{}',
  -- Token analysis
  token_analysis JSONB DEFAULT '{}',
  -- Contract analysis
  contract_analysis JSONB DEFAULT '{}',
  -- Simulation results
  simulation_result JSONB DEFAULT '{}',
  -- Scan metadata
  scan_type TEXT NOT NULL DEFAULT 'pre-transaction', -- 'pre-transaction', 'token', 'address'
  is_malicious BOOLEAN DEFAULT FALSE,
  flags TEXT[],
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- Indexes for security scans
CREATE INDEX IF NOT EXISTS idx_security_scans_user_id ON security_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_security_scans_wallet_address ON security_scans(wallet_address);
CREATE INDEX IF NOT EXISTS idx_security_scans_risk_level ON security_scans(risk_level);
CREATE INDEX IF NOT EXISTS idx_security_scans_created_at ON security_scans(created_at);
CREATE INDEX IF NOT EXISTS idx_security_scans_contract_address ON security_scans(contract_address);

-- Token Security Cache Table
-- Caches token security data to avoid repeated API calls

CREATE TABLE IF NOT EXISTS token_security_cache (
  id SERIAL PRIMARY KEY,
  token_address TEXT NOT NULL,
  network TEXT NOT NULL,
  -- Token metadata
  token_name TEXT,
  token_symbol TEXT,
  token_decimals INTEGER,
  -- Security data
  is_honeypot BOOLEAN DEFAULT FALSE,
  is_malicious BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  -- Risk factors
  risk_score INTEGER DEFAULT 0,
  risk_factors JSONB DEFAULT '[]',
  -- Contract properties
  is_pausable BOOLEAN DEFAULT FALSE,
  is_mintable BOOLEAN DEFAULT FALSE,
  is_blacklisted BOOLEAN DEFAULT FALSE,
  has_proxy BOOLEAN DEFAULT FALSE,
  -- Ownership
  owner_address TEXT,
  liquidity_locked BOOLEAN DEFAULT FALSE,
  locked_amount TEXT,
  lock_expiry TIMESTAMP,
  -- Trading analysis
  buy_tax REAL DEFAULT 0,
  sell_tax REAL DEFAULT 0,
  cannot_sell BOOLEAN DEFAULT FALSE,
  -- Holder analysis
  top_10_holders_percent REAL DEFAULT 0,
  -- Timestamps
  last_verified TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  UNIQUE(token_address, network)
);

-- Indexes for token security cache
CREATE INDEX IF NOT EXISTS idx_token_security_cache_token_address ON token_security_cache(token_address);
CREATE INDEX IF NOT EXISTS idx_token_security_cache_network ON token_security_cache(network);
CREATE INDEX IF NOT EXISTS idx_token_security_cache_expires ON token_security_cache(expires_at);

-- Known Malicious Addresses Table
-- Stores known malicious addresses for quick lookup

CREATE TABLE IF NOT EXISTS known_malicious_addresses (
  id SERIAL PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  network TEXT NOT NULL,
  -- Threat information
  threat_type TEXT NOT NULL, -- 'scam', 'phishing', 'honeypot', 'rug_pull', 'fake_token', 'mixer'
  threat_category TEXT,
  description TEXT,
  -- Source
  source TEXT NOT NULL, -- 'community', 'internal', 'chainalysis', 'nomics', etc.
  confidence REAL DEFAULT 0, -- 0-100 confidence level
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  reported_by TEXT,
  -- Timestamps
  first_seen TIMESTAMP NOT NULL DEFAULT NOW(),
  last_verified TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for malicious addresses
CREATE INDEX IF NOT EXISTS idx_known_malicious_addresses_address ON known_malicious_addresses(address);
CREATE INDEX IF NOT EXISTS idx_known_malicious_addresses_network ON known_malicious_addresses(network);
CREATE INDEX IF NOT EXISTS idx_known_malicious_addresses_threat_type ON known_malicious_addresses(threat_type);
