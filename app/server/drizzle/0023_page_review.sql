CREATE TABLE "page_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"site_id" uuid,
	"report_id" uuid NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"client_markdown" text,
	"client_saved_at" timestamp with time zone,
	"client_saved_by" uuid,
	"client_check" jsonb,
	"final_run_id" uuid,
	"final_report_id" uuid,
	"final_error" text,
	"final_started_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"approved_report_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "fact_answers" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "page_reviews" ADD CONSTRAINT "page_reviews_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_reviews" ADD CONSTRAINT "page_reviews_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_reviews" ADD CONSTRAINT "page_reviews_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_reviews" ADD CONSTRAINT "page_reviews_client_saved_by_users_id_fk" FOREIGN KEY ("client_saved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_reviews" ADD CONSTRAINT "page_reviews_final_run_id_runs_id_fk" FOREIGN KEY ("final_run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_reviews" ADD CONSTRAINT "page_reviews_final_report_id_reports_id_fk" FOREIGN KEY ("final_report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_reviews" ADD CONSTRAINT "page_reviews_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_reviews" ADD CONSTRAINT "page_reviews_approved_report_id_reports_id_fk" FOREIGN KEY ("approved_report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "page_reviews_report_idx" ON "page_reviews" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "page_reviews_org_idx" ON "page_reviews" USING btree ("org_id","updated_at");--> statement-breakpoint
CREATE INDEX "page_reviews_site_idx" ON "page_reviews" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "page_reviews_final_idx" ON "page_reviews" USING btree ("final_report_id");