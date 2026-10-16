ALTER TABLE "runs" ADD COLUMN "actual_cost_partial" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- R102: runs settled before the engine's cost kit (2026-10-13) carry search-data money only (the four legacy rows of 2026-10-03/08);
-- they are not "actual" costs. Runs settled by an earlier-estimated figure keep their flag.
UPDATE "runs" SET "actual_cost_partial" = true WHERE "actual_cost_usd" IS NOT NULL AND "created_at" < '2026-10-13';
