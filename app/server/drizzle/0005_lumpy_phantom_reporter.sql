ALTER TABLE "mailboxes" ADD COLUMN "oauth_refresh" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD COLUMN "oauth_access" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD COLUMN "oauth_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD COLUMN "oauth_scope" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD COLUMN "oauth_subject" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD COLUMN "oauth_cursor" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD COLUMN "reads_replies" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "outreach_sequences" ADD COLUMN "subject_variant" text DEFAULT '' NOT NULL;