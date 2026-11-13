CREATE TABLE "portal"."operator_api_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by" text,
	CONSTRAINT "operator_api_key_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
ALTER TABLE "portal"."project" ADD COLUMN "removed_by" text;--> statement-breakpoint
ALTER TABLE "portal"."project" ADD COLUMN "purged_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "operator_api_key_created_at_idx" ON "portal"."operator_api_key" USING btree ("created_at");