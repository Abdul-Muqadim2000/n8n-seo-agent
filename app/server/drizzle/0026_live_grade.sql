ALTER TABLE "page_reviews" ADD COLUMN "live_grade" jsonb;--> statement-breakpoint
ALTER TABLE "page_reviews" ADD COLUMN "live_graded_at" timestamp with time zone;