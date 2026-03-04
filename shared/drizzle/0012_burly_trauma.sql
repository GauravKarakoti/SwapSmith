CREATE TABLE "strategy_performance" (
	"id" serial PRIMARY KEY NOT NULL,
	"strategy_id" integer NOT NULL,
	"pnl" real NOT NULL,
	"pnl_percent" real NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"executed_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "strategy_subscriptions" (
	"strategy_id" integer NOT NULL,
	"subscriber_id" integer NOT NULL,
	"subscriber_telegram_id" bigint,
	"subscription_fee" text NOT NULL,
	"allocation_percent" real DEFAULT 100 NOT NULL,
	"auto_rebalance" boolean DEFAULT true NOT NULL,
	"stop_loss_percent" real,
	"status" text DEFAULT 'active' NOT NULL,
	"joined_at" timestamp DEFAULT now(),
	"paused_at" timestamp,
	"cancelled_at" timestamp,
	CONSTRAINT "strategy_subscriptions_strategy_id_subscriber_id_unique" UNIQUE("strategy_id","subscriber_id")
);
--> statement-breakpoint
CREATE TABLE "strategy_trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"strategy_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"settle_amount" text,
	"sideshift_order_id" text,
	"error" text,
	"executed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trading_strategies" (
	"id" serial PRIMARY KEY NOT NULL,
	"creator_id" integer NOT NULL,
	"creator_telegram_id" bigint,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"parameters" jsonb NOT NULL,
	"risk_level" text NOT NULL,
	"subscription_fee" text NOT NULL,
	"performance_fee" real NOT NULL,
	"min_investment" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"tags" text[],
	"status" text DEFAULT 'active' NOT NULL,
	"total_return" real DEFAULT 0 NOT NULL,
	"monthly_return" real DEFAULT 0 NOT NULL,
	"max_drawdown" real DEFAULT 0 NOT NULL,
	"subscriber_count" integer DEFAULT 0 NOT NULL,
	"total_trades" integer DEFAULT 0 NOT NULL,
	"successful_trades" integer DEFAULT 0 NOT NULL,
	"sharpe_ratio" real DEFAULT 0,
	"volatility" real DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "strategy_performance" ADD CONSTRAINT "strategy_performance_strategy_id_trading_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."trading_strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_subscriptions" ADD CONSTRAINT "strategy_subscriptions_strategy_id_trading_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."trading_strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_subscriptions" ADD CONSTRAINT "strategy_subscriptions_subscriber_id_users_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_trades" ADD CONSTRAINT "strategy_trades_strategy_id_trading_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."trading_strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_strategies" ADD CONSTRAINT "trading_strategies_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_strategy_performance_strategy" ON "strategy_performance" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "idx_strategy_subscriptions_subscriber" ON "strategy_subscriptions" USING btree ("subscriber_id");--> statement-breakpoint
CREATE INDEX "idx_strategy_trades_strategy" ON "strategy_trades" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "idx_trading_strategies_creator" ON "trading_strategies" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "idx_trading_strategies_status" ON "trading_strategies" USING btree ("status");