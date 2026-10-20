CREATE TABLE "content_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"site_id" uuid,
	"report_id" uuid NOT NULL,
	"keyword" text DEFAULT '' NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"automatic" boolean DEFAULT false NOT NULL,
	"verdict" text DEFAULT 'reject' NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cycle_previews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"cycle_key" text NOT NULL,
	"scheduled_for" timestamp with time zone,
	"body" jsonb NOT NULL,
	"report_id" uuid,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"emailed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "free_research_grants" (
	"domain" text PRIMARY KEY NOT NULL,
	"org_id" uuid,
	"site_id" uuid,
	"run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keyword_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"keyword" text NOT NULL,
	"keyword_norm" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"level" integer DEFAULT 2 NOT NULL,
	"occasion" text DEFAULT 'room' NOT NULL,
	"start_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"run_id" uuid,
	"swapped_for" text,
	"note" text DEFAULT '' NOT NULL,
	"emailed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" uuid
);
--> statement-breakpoint
CREATE TABLE "ladder_rechecks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"ladder_id" text NOT NULL,
	"keyword" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "timezone" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "services" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "cycle_weekday" integer;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "autopilot_level" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "autopilot_dropped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "autopilot_dropped_from" integer;--> statement-breakpoint
ALTER TABLE "content_feedback" ADD CONSTRAINT "content_feedback_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_feedback" ADD CONSTRAINT "content_feedback_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_feedback" ADD CONSTRAINT "content_feedback_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_feedback" ADD CONSTRAINT "content_feedback_by_users_id_fk" FOREIGN KEY ("by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_previews" ADD CONSTRAINT "cycle_previews_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_previews" ADD CONSTRAINT "cycle_previews_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_previews" ADD CONSTRAINT "cycle_previews_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "free_research_grants" ADD CONSTRAINT "free_research_grants_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "free_research_grants" ADD CONSTRAINT "free_research_grants_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "free_research_grants" ADD CONSTRAINT "free_research_grants_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_proposals" ADD CONSTRAINT "keyword_proposals_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_proposals" ADD CONSTRAINT "keyword_proposals_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_proposals" ADD CONSTRAINT "keyword_proposals_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_proposals" ADD CONSTRAINT "keyword_proposals_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ladder_rechecks" ADD CONSTRAINT "ladder_rechecks_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ladder_rechecks" ADD CONSTRAINT "ladder_rechecks_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_feedback_report_idx" ON "content_feedback" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "content_feedback_site_idx" ON "content_feedback" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cycle_previews_site_cycle_idx" ON "cycle_previews" USING btree ("site_id","cycle_key");--> statement-breakpoint
CREATE INDEX "cycle_previews_site_received_idx" ON "cycle_previews" USING btree ("site_id","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "keyword_proposals_site_keyword_idx" ON "keyword_proposals" USING btree ("site_id","keyword_norm");--> statement-breakpoint
CREATE UNIQUE INDEX "keyword_proposals_site_open_idx" ON "keyword_proposals" USING btree ("site_id") WHERE "keyword_proposals"."status" in ('pending', 'starting');--> statement-breakpoint
CREATE INDEX "keyword_proposals_due_idx" ON "keyword_proposals" USING btree ("status","start_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ladder_rechecks_site_ladder_idx" ON "ladder_rechecks" USING btree ("site_id","ladder_id");