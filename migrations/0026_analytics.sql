-- Migration 0026: Executive Dashboard & Analytics

CREATE TABLE IF NOT EXISTS "school_metrics_cache" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "metric_key" text NOT NULL,
  "metric_value" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_school_metrics_unique" ON "school_metrics_cache"("school_id", "metric_key");
