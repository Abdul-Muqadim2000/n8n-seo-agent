CREATE TABLE "bot_ip_ranges" (
	"source_id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"creation_time" text,
	"prefixes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fetched_at" timestamp with time zone,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawler_daily" (
	"site_id" uuid NOT NULL,
	"day" date NOT NULL,
	"bot" text NOT NULL,
	"verification" text NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"s2xx" integer DEFAULT 0 NOT NULL,
	"s3xx" integer DEFAULT 0 NOT NULL,
	"s4xx" integer DEFAULT 0 NOT NULL,
	"s5xx" integer DEFAULT 0 NOT NULL,
	"refused" integer DEFAULT 0 NOT NULL,
	"param_hits" integer DEFAULT 0 NOT NULL,
	"asset_hits" integer DEFAULT 0 NOT NULL,
	"bytes" bigint DEFAULT 0 NOT NULL,
	"ms_sum" bigint DEFAULT 0 NOT NULL,
	"ms_n" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "crawler_daily_site_id_day_bot_verification_pk" PRIMARY KEY("site_id","day","bot","verification")
);
--> statement-breakpoint
CREATE TABLE "crawler_hits" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"ingest_id" uuid,
	"at" timestamp with time zone NOT NULL,
	"bot" text NOT NULL,
	"verification" text NOT NULL,
	"method" text DEFAULT 'GET' NOT NULL,
	"path" text NOT NULL,
	"query_keys" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'page' NOT NULL,
	"status" integer NOT NULL,
	"bytes" bigint,
	"ms" integer,
	"net" text,
	"line_hash" "bytea" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawler_page_daily" (
	"site_id" uuid NOT NULL,
	"day" date NOT NULL,
	"bot" text NOT NULL,
	"path" text NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"verified_hits" integer DEFAULT 0 NOT NULL,
	"s3xx" integer DEFAULT 0 NOT NULL,
	"s4xx" integer DEFAULT 0 NOT NULL,
	"s5xx" integer DEFAULT 0 NOT NULL,
	"param_hits" integer DEFAULT 0 NOT NULL,
	"last_status" integer,
	CONSTRAINT "crawler_page_daily_site_id_day_bot_path_pk" PRIMARY KEY("site_id","day","bot","path")
);
--> statement-breakpoint
CREATE TABLE "log_ingests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"source" text NOT NULL,
	"file_name" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"host" text DEFAULT '' NOT NULL,
	"spool_path" text DEFAULT '' NOT NULL,
	"bytes" bigint DEFAULT 0 NOT NULL,
	"sha256" text NOT NULL,
	"format" text DEFAULT 'unknown' NOT NULL,
	"stats" jsonb,
	"error" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "log_sources" (
	"site_id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"retention_days" integer DEFAULT 30 NOT NULL,
	"push_key_hash" text,
	"push_key_prefix" text,
	"push_key_created_at" timestamp with time zone,
	"push_key_created_by" uuid,
	"last_push_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crawler_daily" ADD CONSTRAINT "crawler_daily_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawler_hits" ADD CONSTRAINT "crawler_hits_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawler_hits" ADD CONSTRAINT "crawler_hits_ingest_id_log_ingests_id_fk" FOREIGN KEY ("ingest_id") REFERENCES "public"."log_ingests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawler_page_daily" ADD CONSTRAINT "crawler_page_daily_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_ingests" ADD CONSTRAINT "log_ingests_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_ingests" ADD CONSTRAINT "log_ingests_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_ingests" ADD CONSTRAINT "log_ingests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_sources" ADD CONSTRAINT "log_sources_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_sources" ADD CONSTRAINT "log_sources_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_sources" ADD CONSTRAINT "log_sources_push_key_created_by_users_id_fk" FOREIGN KEY ("push_key_created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crawler_hits_site_at_idx" ON "crawler_hits" USING btree ("site_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "crawler_hits_site_line_idx" ON "crawler_hits" USING btree ("site_id","line_hash");--> statement-breakpoint
CREATE INDEX "crawler_page_daily_site_bot_path_idx" ON "crawler_page_daily" USING btree ("site_id","bot","path");--> statement-breakpoint
CREATE INDEX "log_ingests_site_created_idx" ON "log_ingests" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE INDEX "log_ingests_status_idx" ON "log_ingests" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "log_ingests_site_sha_idx" ON "log_ingests" USING btree ("site_id","sha256") WHERE "log_ingests"."status" <> 'failed';