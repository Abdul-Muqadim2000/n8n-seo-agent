CREATE TABLE "site_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"task_key" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_check" jsonb,
	"last_check_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"miss_at" timestamp with time zone,
	"skipped_at" timestamp with time zone,
	"skipped_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_tasks" ADD CONSTRAINT "site_tasks_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_tasks" ADD CONSTRAINT "site_tasks_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_tasks" ADD CONSTRAINT "site_tasks_skipped_by_users_id_fk" FOREIGN KEY ("skipped_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "site_tasks_site_key_idx" ON "site_tasks" USING btree ("site_id","task_key");--> statement-breakpoint
CREATE INDEX "site_tasks_org_idx" ON "site_tasks" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "site_tasks_due_idx" ON "site_tasks" USING btree ("last_check_at");