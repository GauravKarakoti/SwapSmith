-- Add unique constraint to coin_price_cache for (coin, network)
ALTER TABLE "coin_price_cache" ADD CONSTRAINT "coin_price_cache_coin_network_unique" UNIQUE("coin", "network");
