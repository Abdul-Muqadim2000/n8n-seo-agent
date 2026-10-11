CREATE TABLE "mailboxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"from_name" text NOT NULL,
	"from_email" text NOT NULL,
	"provider" text DEFAULT 'smtp' NOT NULL,
	"smtp_host" text NOT NULL,
	"smtp_port" integer DEFAULT 465 NOT NULL,
	"smtp_secure" boolean DEFAULT true NOT NULL,
	"imap_host" text NOT NULL,
	"imap_port" integer DEFAULT 993 NOT NULL,
	"imap_secure" boolean DEFAULT true NOT NULL,
	"username" text NOT NULL,
	"secret" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"status_reason" text DEFAULT '' NOT NULL,
	"signature_name" text DEFAULT '' NOT NULL,
	"signature_title" text DEFAULT '' NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"postal_address" text DEFAULT '' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"window_start" integer DEFAULT 8 NOT NULL,
	"window_end" integer DEFAULT 17 NOT NULL,
	"daily_first_max" integer DEFAULT 20 NOT NULL,
	"daily_max" integer DEFAULT 50 NOT NULL,
	"sent_folder" text DEFAULT '' NOT NULL,
	"last_uid" integer DEFAULT 0 NOT NULL,
	"uid_validity" text DEFAULT '' NOT NULL,
	"dns" jsonb,
	"last_poll_at" timestamp with time zone,
	"last_send_at" timestamp with time zone,
	"last_error" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"mailbox_id" uuid,
	"direction" text NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"kind" text DEFAULT 'step' NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"message_id" text DEFAULT '' NOT NULL,
	"in_reply_to" text DEFAULT '' NOT NULL,
	"from_email" text DEFAULT '' NOT NULL,
	"to_email" text DEFAULT '' NOT NULL,
	"error" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"mailbox_id" uuid,
	"prospect_domain" text NOT NULL,
	"prospect_type" text NOT NULL,
	"to_email" text NOT NULL,
	"contact_url" text DEFAULT '' NOT NULL,
	"page_url" text DEFAULT '' NOT NULL,
	"target_url" text DEFAULT '' NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"steps" jsonb NOT NULL,
	"next_at" timestamp with time zone,
	"consent" boolean DEFAULT false NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"last_sent_at" timestamp with time zone,
	"reply_at" timestamp with time zone,
	"reply_class" text,
	"reply_summary" text DEFAULT '' NOT NULL,
	"suggested_reply" text DEFAULT '' NOT NULL,
	"reply_from" text DEFAULT '' NOT NULL,
	"ooo_until" timestamp with time zone,
	"won_at" timestamp with time zone,
	"error" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"value_hash" text NOT NULL,
	"hint" text DEFAULT '' NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "link_settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD CONSTRAINT "mailboxes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD CONSTRAINT "mailboxes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_sequence_id_outreach_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."outreach_sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_sequences" ADD CONSTRAINT "outreach_sequences_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_sequences" ADD CONSTRAINT "outreach_sequences_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_sequences" ADD CONSTRAINT "outreach_sequences_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_sequences" ADD CONSTRAINT "outreach_sequences_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppressions" ADD CONSTRAINT "suppressions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mailboxes_org_email_idx" ON "mailboxes" USING btree ("org_id","from_email");--> statement-breakpoint
CREATE INDEX "outreach_msg_seq_idx" ON "outreach_messages" USING btree ("sequence_id","at");--> statement-breakpoint
CREATE INDEX "outreach_msg_org_mid_idx" ON "outreach_messages" USING btree ("org_id","message_id");--> statement-breakpoint
CREATE INDEX "outreach_msg_mailbox_at_idx" ON "outreach_messages" USING btree ("mailbox_id","direction","at");--> statement-breakpoint
CREATE INDEX "outreach_seq_site_idx" ON "outreach_sequences" USING btree ("site_id","prospect_domain");--> statement-breakpoint
CREATE INDEX "outreach_seq_due_idx" ON "outreach_sequences" USING btree ("status","next_at");--> statement-breakpoint
CREATE INDEX "outreach_seq_org_to_idx" ON "outreach_sequences" USING btree ("org_id","to_email");--> statement-breakpoint
CREATE UNIQUE INDEX "suppressions_org_kind_hash_idx" ON "suppressions" USING btree ("org_id","kind","value_hash");