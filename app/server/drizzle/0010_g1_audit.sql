CREATE TABLE "audit_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"org_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"action" text NOT NULL,
	"outcome" text DEFAULT 'success' NOT NULL,
	"actor_type" text NOT NULL,
	"actor_user_id" uuid,
	"actor_label" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"target_label" text,
	"ip" text,
	"user_agent" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_org_idx" ON "audit_events" USING btree ("org_id","id");--> statement-breakpoint
CREATE INDEX "audit_events_org_at_idx" ON "audit_events" USING btree ("org_id","at");--> statement-breakpoint
CREATE INDEX "audit_events_org_action_idx" ON "audit_events" USING btree ("org_id","action");--> statement-breakpoint
-- G1: the audit log is append-only in the database itself. UPDATE and TRUNCATE are always refused; DELETE only by the retention
-- purge (which sets ascentra.audit_purge for its own transaction) or when the company itself is gone (its ON DELETE CASCADE).
CREATE FUNCTION "audit_events_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('ascentra.audit_purge', true) = 'on' THEN RETURN OLD; END IF;
    IF NOT EXISTS (SELECT 1 FROM "organizations" WHERE "id" = OLD."org_id") THEN RETURN OLD; END IF;
  END IF;
  RAISE EXCEPTION 'audit_events is append-only (%)', TG_OP USING ERRCODE = 'insufficient_privilege';
END
$$;
--> statement-breakpoint
CREATE TRIGGER "audit_events_no_change" BEFORE UPDATE OR DELETE ON "audit_events" FOR EACH ROW EXECUTE FUNCTION "audit_events_guard"();
--> statement-breakpoint
CREATE TRIGGER "audit_events_no_truncate" BEFORE TRUNCATE ON "audit_events" FOR EACH STATEMENT EXECUTE FUNCTION "audit_events_guard"();
