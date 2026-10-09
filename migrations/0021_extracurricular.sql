-- Migration 0021: Extracurricular Activities & Clubs

CREATE TABLE IF NOT EXISTS "extracurricular_activities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "instructor" text,
  "max_capacity" integer DEFAULT 20 NOT NULL,
  "schedule" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_extracurricular_school" ON "extracurricular_activities"("school_id");
