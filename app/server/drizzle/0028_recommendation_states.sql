CREATE TABLE "recommendation_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"rec_key" text NOT NULL,
	"issue_key" text DEFAULT '' NOT NULL,
	"state" text DEFAULT 'open' NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"evidence" text DEFAULT '' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"state_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dismissed_reason" text DEFAULT '' NOT NULL,
	"dismissed_note" text DEFAULT '' NOT NULL,
	"by_user" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recommendation_states" ADD CONSTRAINT "recommendation_states_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_states" ADD CONSTRAINT "recommendation_states_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_states" ADD CONSTRAINT "recommendation_states_by_user_users_id_fk" FOREIGN KEY ("by_user") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_states_site_key_idx" ON "recommendation_states" USING btree ("site_id","rec_key");--> statement-breakpoint
CREATE INDEX "recommendation_states_org_idx" ON "recommendation_states" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "recommendation_states_state_idx" ON "recommendation_states" USING btree ("site_id","state");