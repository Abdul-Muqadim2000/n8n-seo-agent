ALTER TABLE "organizations" ADD COLUMN "previous_hook_token" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "hook_token_rotated_at" timestamp with time zone;