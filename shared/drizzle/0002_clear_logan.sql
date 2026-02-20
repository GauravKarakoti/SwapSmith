CREATE INDEX "idx_discussions_category" ON "discussions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_discussions_created_at" ON "discussions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_discussions_user_id" ON "discussions" USING btree ("user_id");