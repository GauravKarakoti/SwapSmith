-- Price Alerts Table
CREATE TABLE IF NOT EXISTS price_alerts (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  telegram_id BIGINT,
  coin TEXT NOT NULL,
  network TEXT NOT NULL,
  name TEXT NOT NULL,
  target_price NUMERIC(20, 8) NOT NULL,
  condition TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  triggered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for price_alerts
CREATE INDEX IF NOT EXISTS idx_price_alerts_user_id ON price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_telegram_id ON price_alerts(telegram_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_is_active ON price_alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_price_alerts_coin_network ON price_alerts(coin, network);
