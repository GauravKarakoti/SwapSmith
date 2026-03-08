-- Migration: Add Trading Strategy Marketplace Tables
-- Date: 2024

-- Enums
CREATE TYPE strategy_risk_level AS ENUM ('low', 'medium', 'high', 'aggressive');
CREATE TYPE strategy_status AS ENUM ('active', 'paused', 'archived');
CREATE TYPE subscription_status AS ENUM ('active', 'paused', 'cancelled');

-- Trading Strategies Table
CREATE TABLE trading_strategies (
  id SERIAL PRIMARY KEY,
  creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_telegram_id BIGINT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}',
  risk_level strategy_risk_level NOT NULL DEFAULT 'medium',
  status strategy_status NOT NULL DEFAULT 'active',
  subscription_fee NUMERIC(20, 8) NOT NULL DEFAULT '0',
  performance_fee REAL NOT NULL DEFAULT 0,
  subscriber_count INTEGER NOT NULL DEFAULT 0,
  total_trades INTEGER NOT NULL DEFAULT 0,
  successful_trades INTEGER NOT NULL DEFAULT 0,
  total_return REAL NOT NULL DEFAULT 0,
  monthly_return REAL NOT NULL DEFAULT 0,
  sharpe_ratio REAL NOT NULL DEFAULT 0,
  max_drawdown REAL NOT NULL DEFAULT 0,
  volatility REAL NOT NULL DEFAULT 0,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  min_investment NUMERIC(20, 8) NOT NULL DEFAULT '100',
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trading_strategies_creator_id ON trading_strategies(creator_id);
CREATE INDEX idx_trading_strategies_status ON trading_strategies(status);
CREATE INDEX idx_trading_strategies_risk_level ON trading_strategies(risk_level);
CREATE INDEX idx_trading_strategies_total_return ON trading_strategies(total_return);

-- Strategy Subscriptions Table
CREATE TABLE strategy_subscriptions (
  id SERIAL PRIMARY KEY,
  strategy_id INTEGER NOT NULL REFERENCES trading_strategies(id) ON DELETE CASCADE,
  subscriber_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscriber_telegram_id BIGINT,
  subscription_fee NUMERIC(20, 8) NOT NULL DEFAULT '0',
  allocation_percent REAL NOT NULL DEFAULT 100,
  auto_rebalance BOOLEAN NOT NULL DEFAULT true,
  stop_loss_percent REAL,
  status subscription_status NOT NULL DEFAULT 'active',
  total_pnl NUMERIC(20, 8) NOT NULL DEFAULT '0',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP WITH TIME ZONE,
  paused_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(strategy_id, subscriber_id)
);

CREATE INDEX idx_strategy_subscriptions_strategy_id ON strategy_subscriptions(strategy_id);
CREATE INDEX idx_strategy_subscriptions_subscriber_id ON strategy_subscriptions(subscriber_id);
CREATE INDEX idx_strategy_subscriptions_status ON strategy_subscriptions(status);

-- Strategy Performance Table
CREATE TABLE strategy_performance (
  id SERIAL PRIMARY KEY,
  strategy_id INTEGER NOT NULL REFERENCES trading_strategies(id) ON DELETE CASCADE,
  trade_id TEXT,
  from_asset TEXT,
  to_asset TEXT,
  from_amount NUMERIC(20, 8),
  to_amount NUMERIC(20, 8),
  pnl NUMERIC(20, 8) NOT NULL DEFAULT '0',
  pnl_percent REAL NOT NULL DEFAULT 0,
  fees NUMERIC(20, 8) NOT NULL DEFAULT '0',
  status TEXT NOT NULL DEFAULT 'pending',
  executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_strategy_performance_strategy_id ON strategy_performance(strategy_id);
CREATE INDEX idx_strategy_performance_executed_at ON strategy_performance(executed_at);

-- Strategy Trades Table
CREATE TABLE strategy_trades (
  id SERIAL PRIMARY KEY,
  strategy_id INTEGER NOT NULL REFERENCES trading_strategies(id) ON DELETE CASCADE,
  signal TEXT NOT NULL,
  from_asset TEXT NOT NULL,
  to_asset TEXT NOT NULL,
  from_network TEXT NOT NULL,
  to_network TEXT NOT NULL,
  amount NUMERIC(20, 8) NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE,
  sideshift_order_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  settle_amount NUMERIC(20, 8),
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_strategy_trades_strategy_id ON strategy_trades(strategy_id);
CREATE INDEX idx_strategy_trades_executed_at ON strategy_trades(executed_at);
CREATE INDEX idx_strategy_trades_status ON strategy_trades(status);
