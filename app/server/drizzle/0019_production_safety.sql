DROP INDEX "keyword_proposals_site_keyword_idx";--> statement-breakpoint
ALTER TABLE "keyword_checks" ADD COLUMN "automatic" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "sites_verified_engine_id_idx" ON "sites" USING btree (('site_' || regexp_replace("domain", '[^a-z0-9]+', '-', 'g'))) WHERE "sites"."verified_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "keyword_proposals_site_keyword_idx" ON "keyword_proposals" USING btree ("site_id","keyword_norm") WHERE "keyword_proposals"."status" <> 'failed';