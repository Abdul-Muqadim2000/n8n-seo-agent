CREATE TABLE "cms_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"base_url" text DEFAULT '' NOT NULL,
	"username" text DEFAULT '' NOT NULL,
	"secret" text DEFAULT '' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'untested' NOT NULL,
	"status_reason" text DEFAULT '' NOT NULL,
	"last_tested_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"keyword" text DEFAULT '' NOT NULL,
	"remote_id" text DEFAULT '' NOT NULL,
	"remote_url" text DEFAULT '' NOT NULL,
	"remote_status" text DEFAULT 'unknown' NOT NULL,
	"last_report_id" uuid,
	"media" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"lock_until" timestamp with time zone,
	"engine_told_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_publishes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"site_id" uuid,
	"connection_id" uuid,
	"item_id" uuid,
	"report_id" uuid,
	"user_id" uuid,
	"kind" text DEFAULT '' NOT NULL,
	"connection_label" text DEFAULT '' NOT NULL,
	"keyword" text DEFAULT '' NOT NULL,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"remote_id" text DEFAULT '' NOT NULL,
	"remote_url" text DEFAULT '' NOT NULL,
	"target" text DEFAULT '' NOT NULL,
	"error" text DEFAULT '' NOT NULL,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blockers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"engine_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cms_connections" ADD CONSTRAINT "cms_connections_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_connections" ADD CONSTRAINT "cms_connections_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_connections" ADD CONSTRAINT "cms_connections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_items" ADD CONSTRAINT "cms_items_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_items" ADD CONSTRAINT "cms_items_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_items" ADD CONSTRAINT "cms_items_connection_id_cms_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."cms_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_items" ADD CONSTRAINT "cms_items_last_report_id_reports_id_fk" FOREIGN KEY ("last_report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_publishes" ADD CONSTRAINT "cms_publishes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_publishes" ADD CONSTRAINT "cms_publishes_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_publishes" ADD CONSTRAINT "cms_publishes_connection_id_cms_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."cms_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_publishes" ADD CONSTRAINT "cms_publishes_item_id_cms_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."cms_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_publishes" ADD CONSTRAINT "cms_publishes_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_publishes" ADD CONSTRAINT "cms_publishes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_publishes" ADD CONSTRAINT "cms_publishes_engine_run_id_runs_id_fk" FOREIGN KEY ("engine_run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cms_connections_site_idx" ON "cms_connections" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "cms_connections_org_idx" ON "cms_connections" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_items_connection_slug_idx" ON "cms_items" USING btree ("connection_id","slug");--> statement-breakpoint
CREATE INDEX "cms_items_site_idx" ON "cms_items" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "cms_publishes_org_created_idx" ON "cms_publishes" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "cms_publishes_report_idx" ON "cms_publishes" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "cms_publishes_site_idx" ON "cms_publishes" USING btree ("site_id","created_at");