-- Migration 0015: Passaporte Educacional (Fase 10)

ALTER TABLE "student" ADD COLUMN IF NOT EXISTS "passport_token" text UNIQUE;
ALTER TABLE "student" ADD COLUMN IF NOT EXISTS "passport_active" boolean NOT NULL DEFAULT true;
ALTER TABLE "student" ADD COLUMN IF NOT EXISTS "passport_updated_at" timestamp with time zone NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS "passport_verification" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "school"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "student"("id") ON DELETE CASCADE,
  "verifier_user_id" text NOT NULL,
  "status" text NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "passport_verification_school_time" ON "passport_verification"("school_id", "occurred_at");
