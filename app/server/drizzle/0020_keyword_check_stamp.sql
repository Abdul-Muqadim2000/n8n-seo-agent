ALTER TABLE "keyword_checks" ADD COLUMN "rules_version" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "keyword_checks" ADD COLUMN "context_hash" text DEFAULT '' NOT NULL;