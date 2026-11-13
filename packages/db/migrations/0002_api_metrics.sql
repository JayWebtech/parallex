CREATE SCHEMA "api_metrics";
--> statement-breakpoint
CREATE TABLE "api_metrics"."ingest_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "ingest_key_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "api_metrics"."ingest_warning_day" (
	"project_id" uuid NOT NULL,
	"day" date NOT NULL,
	"secrets_redacted" bigint DEFAULT 0 NOT NULL,
	"routes_overflowed" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "ingest_warning_day_pk" PRIMARY KEY("project_id","day")
);
--> statement-breakpoint
CREATE TABLE "api_metrics"."request_day" (
	"project_id" uuid NOT NULL,
	"service_name" text NOT NULL,
	"method" text NOT NULL,
	"route" text NOT NULL,
	"status_code" smallint NOT NULL,
	"source" text NOT NULL,
	"day" date NOT NULL,
	"count" bigint NOT NULL,
	"duration_sum_ms" double precision NOT NULL,
	"duration_buckets" bigint[] NOT NULL,
	CONSTRAINT "request_day_pk" PRIMARY KEY("project_id","day","service_name","method","route","status_code","source")
);
--> statement-breakpoint
CREATE TABLE "api_metrics"."request_hour" (
	"project_id" uuid NOT NULL,
	"service_name" text NOT NULL,
	"method" text NOT NULL,
	"route" text NOT NULL,
	"status_code" smallint NOT NULL,
	"source" text NOT NULL,
	"hour" timestamp with time zone NOT NULL,
	"count" bigint NOT NULL,
	"duration_sum_ms" double precision NOT NULL,
	"duration_buckets" bigint[] NOT NULL,
	CONSTRAINT "request_hour_pk" PRIMARY KEY("project_id","hour","service_name","method","route","status_code","source")
);
--> statement-breakpoint
CREATE TABLE "api_metrics"."request_minute" (
	"project_id" uuid NOT NULL,
	"service_name" text NOT NULL,
	"method" text NOT NULL,
	"route" text NOT NULL,
	"status_code" smallint NOT NULL,
	"source" text NOT NULL,
	"minute" timestamp with time zone NOT NULL,
	"count" bigint NOT NULL,
	"duration_sum_ms" double precision NOT NULL,
	"duration_buckets" bigint[] NOT NULL,
	CONSTRAINT "request_minute_pk" PRIMARY KEY("project_id","minute","service_name","method","route","status_code","source")
);
--> statement-breakpoint
ALTER TABLE "api_metrics"."ingest_key" ADD CONSTRAINT "ingest_key_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "portal"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingest_key_project_idx" ON "api_metrics"."ingest_key" USING btree ("project_id");