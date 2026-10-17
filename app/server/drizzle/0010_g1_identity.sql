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
CREATE TABLE "auth_flows" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"user_id" uuid,
	"org_id" uuid,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mfa_recovery_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sso_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"protocol" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"enforced" boolean DEFAULT false NOT NULL,
	"jit_enabled" boolean DEFAULT true NOT NULL,
	"default_role" text DEFAULT 'member' NOT NULL,
	"oidc_issuer" text,
	"oidc_client_id" text,
	"oidc_client_secret" text,
	"saml_entity_id" text,
	"saml_sso_url" text,
	"saml_certs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_test_at" timestamp with time zone,
	"last_test_ok" boolean,
	"last_test_message" text,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sso_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"verification_token" text NOT NULL,
	"verified_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sso_identities" (
	"connection_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "sso_identities_connection_id_subject_pk" PRIMARY KEY("connection_id","subject")
);
--> statement-breakpoint
CREATE TABLE "webauthn_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" "bytea" NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"device_type" text DEFAULT 'singleDevice' NOT NULL,
	"backed_up" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "security_policy" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "auth_method" text DEFAULT 'password' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "sso_org_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "mfa_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "reauth_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "public_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "idle_timeout_minutes" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mfa_totp_secret" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mfa_totp_pending" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mfa_totp_enabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mfa_totp_last_step" integer;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_flows" ADD CONSTRAINT "auth_flows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_connections" ADD CONSTRAINT "sso_connections_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_domains" ADD CONSTRAINT "sso_domains_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_domains" ADD CONSTRAINT "sso_domains_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_identities" ADD CONSTRAINT "sso_identities_connection_id_sso_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."sso_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_identities" ADD CONSTRAINT "sso_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_org_idx" ON "audit_events" USING btree ("org_id","id");--> statement-breakpoint
CREATE INDEX "audit_events_org_at_idx" ON "audit_events" USING btree ("org_id","at");--> statement-breakpoint
CREATE INDEX "audit_events_org_action_idx" ON "audit_events" USING btree ("org_id","action");--> statement-breakpoint
CREATE INDEX "auth_flows_expires_idx" ON "auth_flows" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "mfa_recovery_user_idx" ON "mfa_recovery_codes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mfa_recovery_hash_idx" ON "mfa_recovery_codes" USING btree ("user_id","code_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "sso_connections_org_idx" ON "sso_connections" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sso_domains_org_domain_idx" ON "sso_domains" USING btree ("org_id","domain");--> statement-breakpoint
CREATE UNIQUE INDEX "sso_domains_verified_idx" ON "sso_domains" USING btree ("domain") WHERE "sso_domains"."verified_at" is not null;--> statement-breakpoint
CREATE INDEX "sso_identities_user_idx" ON "sso_identities" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webauthn_credential_idx" ON "webauthn_credentials" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "webauthn_user_idx" ON "webauthn_credentials" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_public_idx" ON "sessions" USING btree ("public_id");--> statement-breakpoint
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
