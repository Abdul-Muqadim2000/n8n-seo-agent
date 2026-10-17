ALTER TABLE "sessions" ADD COLUMN "public_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "idle_timeout_minutes" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_public_idx" ON "sessions" USING btree ("public_id");