CREATE TABLE "keyword_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"site_id" uuid,
	"user_id" uuid,
	"keyword" text NOT NULL,
	"country" text NOT NULL,
	"status" text DEFAULT 'done' NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "keyword_checks" ADD CONSTRAINT "keyword_checks_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_checks" ADD CONSTRAINT "keyword_checks_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_checks" ADD CONSTRAINT "keyword_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "keyword_checks_org_created_idx" ON "keyword_checks" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "keyword_checks_site_keyword_idx" ON "keyword_checks" USING btree ("site_id","keyword","country");