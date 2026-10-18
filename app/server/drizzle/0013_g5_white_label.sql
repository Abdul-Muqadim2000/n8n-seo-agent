CREATE TABLE "portal_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"site_id" uuid,
	"kind" text NOT NULL,
	"item_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"requested_by" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decision_note" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "portal_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"host" text NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"verified_at" timestamp with time zone,
	"last_check_at" timestamp with time zone,
	"last_check_ok" boolean,
	"last_check_detail" text,
	"failures" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "kind" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "parent_org_id" uuid;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "branding" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "portal_mail" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "client_approval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "portal_approvals" ADD CONSTRAINT "portal_approvals_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_approvals" ADD CONSTRAINT "portal_approvals_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_approvals" ADD CONSTRAINT "portal_approvals_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_approvals" ADD CONSTRAINT "portal_approvals_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_domains" ADD CONSTRAINT "portal_domains_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_domains" ADD CONSTRAINT "portal_domains_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "portal_approvals_org_idx" ON "portal_approvals" USING btree ("org_id","requested_at");--> statement-breakpoint
CREATE INDEX "portal_approvals_item_idx" ON "portal_approvals" USING btree ("org_id","kind","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_domains_org_host_idx" ON "portal_domains" USING btree ("org_id","host");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_domains_live_host_idx" ON "portal_domains" USING btree ("host") WHERE "portal_domains"."status" in ('verified', 'lapsed');--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parent_org_id_organizations_id_fk" FOREIGN KEY ("parent_org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organizations_parent_idx" ON "organizations" USING btree ("parent_org_id");