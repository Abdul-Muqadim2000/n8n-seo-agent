CREATE TABLE "admin_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid,
	"actor_email" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"target_label" text DEFAULT '' NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_key" text NOT NULL,
	"source" text NOT NULL,
	"engine_run_id" text,
	"run_id" uuid,
	"org_id" uuid,
	"site_id" uuid,
	"user_id" uuid,
	"domain" text DEFAULT '' NOT NULL,
	"mode" text DEFAULT '' NOT NULL,
	"origin" text DEFAULT 'schedule' NOT NULL,
	"engine_key" text DEFAULT '' NOT NULL,
	"claude_usd" double precision DEFAULT 0 NOT NULL,
	"claude_estimated_usd" double precision DEFAULT 0 NOT NULL,
	"dataforseo_usd" double precision DEFAULT 0 NOT NULL,
	"certainty" text DEFAULT 'measured' NOT NULL,
	"balance_before" double precision DEFAULT 0 NOT NULL,
	"balance_after" double precision DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"occurred_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"engine_settled_at" text DEFAULT '' NOT NULL,
	"detached_from" text
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigserial NOT NULL,
	"org_id" uuid,
	"org_name" text DEFAULT '' NOT NULL,
	"kind" text NOT NULL,
	"credits" double precision NOT NULL,
	"paid_usd" double precision DEFAULT 0 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"ref" jsonb,
	"ref_key" text,
	"actor_user_id" uuid,
	"actor_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"credit_value_usd" double precision NOT NULL,
	"markup" double precision NOT NULL,
	"signup_credits" double precision DEFAULT 0 NOT NULL,
	"enforce_for_new_companies" boolean DEFAULT false NOT NULL,
	"credits_since" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"updated_by" text,
	"ledger_synced_at" timestamp with time zone,
	"ledger_sync_ok" boolean DEFAULT false NOT NULL,
	"ledger_sync_note" text DEFAULT '' NOT NULL,
	"ledger_rows" integer DEFAULT 0 NOT NULL,
	"ledger_watermark" text,
	"ledger_full_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "credits_enforced" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_at_idx" ON "admin_audit" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "cost_events_key_idx" ON "cost_events" USING btree ("event_key");--> statement-breakpoint
CREATE INDEX "cost_events_user_idx" ON "cost_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cost_events_site_idx" ON "cost_events" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cost_events_engine_run_idx" ON "cost_events" USING btree ("engine_run_id") WHERE "cost_events"."engine_run_id" is not null;--> statement-breakpoint
CREATE INDEX "cost_events_org_at_idx" ON "cost_events" USING btree ("org_id","occurred_at");--> statement-breakpoint
CREATE INDEX "cost_events_at_idx" ON "cost_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "cost_events_run_idx" ON "cost_events" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "credit_ledger_org_idx" ON "credit_ledger" USING btree ("org_id","seq");--> statement-breakpoint
CREATE INDEX "credit_ledger_org_created_idx" ON "credit_ledger" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_ref_key_idx" ON "credit_ledger" USING btree ("ref_key") WHERE "credit_ledger"."ref_key" is not null;--> statement-breakpoint
CREATE INDEX "runs_request_idx" ON "runs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "runs_user_idx" ON "runs" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_one_row" CHECK ("id" = 1);--> statement-breakpoint
INSERT INTO "platform_settings" ("id", "credit_value_usd", "markup", "signup_credits", "enforce_for_new_companies") VALUES (1, 0.1, 3, 0, false) ON CONFLICT DO NOTHING;
