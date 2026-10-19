CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"year" integer NOT NULL,
	"seq" integer NOT NULL,
	"org_id" uuid,
	"org_name" text NOT NULL,
	"ledger_id" uuid NOT NULL,
	"request_id" uuid,
	"credits" double precision NOT NULL,
	"amount_usd" double precision NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"description" text NOT NULL,
	"billed_to" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"issuer" jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"issued_by" text DEFAULT '' NOT NULL,
	"emailed_at" timestamp with time zone,
	"emailed_to" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_idx" ON "invoices" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_year_seq_idx" ON "invoices" USING btree ("year","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_ledger_idx" ON "invoices" USING btree ("ledger_id");--> statement-breakpoint
CREATE INDEX "invoices_org_idx" ON "invoices" USING btree ("org_id","issued_at");