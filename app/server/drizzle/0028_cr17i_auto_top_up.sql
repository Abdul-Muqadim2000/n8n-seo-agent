ALTER TABLE "credit_purchase_requests" ADD COLUMN "auto" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "auto_top_up_pack_id" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "auto_top_up_by" uuid;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "auto_top_up_armed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_auto_top_up_by_users_id_fk" FOREIGN KEY ("auto_top_up_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;