CREATE INDEX "idx_address_book_telegram_id" ON "address_book" USING btree ("telegram_id");--> statement-breakpoint
CREATE INDEX "idx_checkouts_telegram_id" ON "checkouts" USING btree ("telegram_id");--> statement-breakpoint
CREATE INDEX "idx_dca_schedules_telegram_id" ON "dca_schedules" USING btree ("telegram_id");--> statement-breakpoint
CREATE INDEX "idx_watched_orders_telegram_id" ON "watched_orders" USING btree ("telegram_id");