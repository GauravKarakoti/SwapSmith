ALTER TABLE "discussions" ADD COLUMN "is_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "discussions" ADD COLUMN "moderation_reason" text;