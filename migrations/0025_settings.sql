-- Migration 0025: School Settings & Branding

CREATE TABLE IF NOT EXISTS "school_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "academic_year" text NOT NULL,
  "logo_url" text,
  "contact_email" text,
  "phone" text,
  "address" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_school_settings_unique" ON "school_settings"("school_id");
