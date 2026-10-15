CREATE TABLE "report_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"report_id" uuid,
	"channel" text NOT NULL,
	"target" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"kind" text DEFAULT 'each' NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "delivery_settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "delivery_webhook_secret" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "delivery_last_run_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "engine_cost_estimate_usd" double precision;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "engine_cost_basis" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "actual_cost_estimated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "report_deliveries" ADD CONSTRAINT "report_deliveries_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_deliveries" ADD CONSTRAINT "report_deliveries_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_deliveries_org_created_idx" ON "report_deliveries" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "report_deliveries_report_idx" ON "report_deliveries" USING btree ("report_id");--> statement-breakpoint
CREATE UNIQUE INDEX "report_deliveries_once_idx" ON "report_deliveries" USING btree ("report_id","channel") WHERE "report_deliveries"."report_id" is not null;