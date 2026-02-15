-- Migration: Add delayed orders and price alerts tables for Limit Orders & DCA

-- Table for storing delayed orders (Limit Orders and DCA)
CREATE TABLE "delayed_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"order_type" text NOT NULL, -- 'limit_order' or 'dca'
	"intent_data" text NOT NULL, -- JSON string containing full ParsedCommand
	
	-- Common fields
	"from_asset" text,
	"from_chain" text,
	"to_asset" text NOT NULL,
	"to_chain" text,
	"amount" real NOT NULL,
	"settle_address" text NOT NULL,
	
	-- Limit Order specific fields
	"target_price" real,
	"condition" text, -- 'above' or 'below'
	"expiry_date" timestamp,
	
	-- DCA specific fields
	"frequency" text, -- 'daily', 'weekly', or 'monthly'
	"total_amount" real,
	"num_purchases" integer,
	"start_date" timestamp,
	
	-- Execution tracking
	"status" text DEFAULT 'pending' NOT NULL, -- 'pending', 'active', 'completed', 'cancelled', 'expired'
	"execution_count" integer DEFAULT 0,
	"max_executions" integer DEFAULT 1,
	"next_execution_at" timestamp,
	"last_executed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Table for tracking price alerts and historical prices
CREATE TABLE "price_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset" text NOT NULL,
	"chain" text,
	"target_price" real NOT NULL,
	"condition" text NOT NULL, -- 'above' or 'below'
	"current_price" real,
	"triggered" boolean DEFAULT false,
	"delayed_order_id" integer,
	"created_at" timestamp DEFAULT now(),
	"triggered_at" timestamp
);

-- Indexes for efficient querying
CREATE INDEX "delayed_orders_telegram_id_idx" ON "delayed_orders" ("telegram_id");
CREATE INDEX "delayed_orders_status_idx" ON "delayed_orders" ("status");
CREATE INDEX "delayed_orders_next_execution_idx" ON "delayed_orders" ("next_execution_at");
CREATE INDEX "price_alerts_asset_idx" ON "price_alerts" ("asset");
CREATE INDEX "price_alerts_triggered_idx" ON "price_alerts" ("triggered");
