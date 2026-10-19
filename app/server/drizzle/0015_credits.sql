CREATE TABLE "credit_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"source" text NOT NULL,
	"credits" double precision NOT NULL,
	"remaining" double precision NOT NULL,
	"expires_at" timestamp with time zone,
	"note" text DEFAULT '' NOT NULL,
	"ledger_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_purchase_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"org_name" text DEFAULT '' NOT NULL,
	"pack_id" text NOT NULL,
	"credits" double precision NOT NULL,
	"price_usd" double precision NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by" uuid,
	"requested_by_email" text,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"ledger_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "credit_limits" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "plan_monthly_credits" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "plan_granted_month" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "credit_alert_level" text DEFAULT 'ok' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "credit_alert_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "credit_packs" jsonb;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "pack_expiry_months" integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "plan_rollover" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "signup_expiry_days" integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "quoted_credits" double precision;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "credits_paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "credits_paused_reason" text;--> statement-breakpoint
ALTER TABLE "credit_lots" ADD CONSTRAINT "credit_lots_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_purchase_requests" ADD CONSTRAINT "credit_purchase_requests_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_purchase_requests" ADD CONSTRAINT "credit_purchase_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_lots_org_idx" ON "credit_lots" USING btree ("org_id","expires_at");--> statement-breakpoint
CREATE INDEX "credit_purchase_requests_org_idx" ON "credit_purchase_requests" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_purchase_requests_status_idx" ON "credit_purchase_requests" USING btree ("status");--> statement-breakpoint
-- the credit defaults of app/docs/CREDITS.md, only where an administrator never changed the settings: $0.05 a credit, 200 welcome credits, credits enforced for new companies
UPDATE "platform_settings" SET "credit_value_usd" = 0.05, "signup_credits" = 200, "enforce_for_new_companies" = true WHERE "id" = 1 AND "updated_at" IS NULL;--> statement-breakpoint
-- every company's positive balance becomes one lot that never expires (what was used beyond it stays as debt: no lot)
INSERT INTO "credit_lots" ("org_id", "source", "credits", "remaining", "note")
  SELECT "org_id", 'migrated', sum("credits"), sum("credits"), 'Balance before credit lots' FROM "credit_ledger"
  WHERE "org_id" IS NOT NULL GROUP BY "org_id" HAVING sum("credits") > 0;
