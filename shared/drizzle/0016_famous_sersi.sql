ALTER TABLE "gas_estimates" ALTER COLUMN "confidence" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "gas_optimization_history" ALTER COLUMN "savings_percent" SET DATA TYPE numeric(10, 4);--> statement-breakpoint
ALTER TABLE "gas_tokens" ALTER COLUMN "discount_percent" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "gas_tokens" ALTER COLUMN "discount_percent" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "limit_orders" ALTER COLUMN "condition_value" SET DATA TYPE numeric(30, 18);--> statement-breakpoint
ALTER TABLE "portfolio_targets" ALTER COLUMN "drift_threshold" SET DATA TYPE numeric(10, 4);--> statement-breakpoint
ALTER TABLE "portfolio_targets" ALTER COLUMN "drift_threshold" SET DEFAULT '5';--> statement-breakpoint
ALTER TABLE "strategy_performance" ALTER COLUMN "pnl_percent" SET DATA TYPE numeric(15, 8);--> statement-breakpoint
ALTER TABLE "strategy_subscriptions" ALTER COLUMN "allocation_percent" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "strategy_subscriptions" ALTER COLUMN "allocation_percent" SET DEFAULT '100';--> statement-breakpoint
ALTER TABLE "strategy_subscriptions" ALTER COLUMN "stop_loss_percent" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "swap_history" ALTER COLUMN "from_amount" SET DATA TYPE numeric(30, 18);--> statement-breakpoint
ALTER TABLE "trading_strategies" ALTER COLUMN "performance_fee" SET DATA TYPE numeric(10, 4);--> statement-breakpoint
ALTER TABLE "trading_strategies" ALTER COLUMN "performance_fee" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "trading_strategies" ALTER COLUMN "total_return" SET DATA TYPE numeric(15, 8);--> statement-breakpoint
ALTER TABLE "trading_strategies" ALTER COLUMN "total_return" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "trading_strategies" ALTER COLUMN "monthly_return" SET DATA TYPE numeric(15, 8);--> statement-breakpoint
ALTER TABLE "trading_strategies" ALTER COLUMN "monthly_return" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "trading_strategies" ALTER COLUMN "max_drawdown" SET DATA TYPE numeric(15, 8);--> statement-breakpoint
ALTER TABLE "trading_strategies" ALTER COLUMN "max_drawdown" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "trading_strategies" ALTER COLUMN "volatility" SET DATA TYPE numeric(15, 8);--> statement-breakpoint
ALTER TABLE "trading_strategies" ALTER COLUMN "volatility" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "trading_strategies" ALTER COLUMN "sharpe_ratio" SET DATA TYPE numeric(15, 8);--> statement-breakpoint
ALTER TABLE "trading_strategies" ALTER COLUMN "sharpe_ratio" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "trailing_stop_orders" ALTER COLUMN "trailing_percentage" SET DATA TYPE numeric(10, 4);--> statement-breakpoint
ALTER TABLE "user_settings" ALTER COLUMN "slippage_tolerance" SET DATA TYPE numeric(10, 4);