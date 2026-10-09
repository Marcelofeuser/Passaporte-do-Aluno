-- Migration 0031: Digital Student Pass & QR Code Verification

CREATE TABLE IF NOT EXISTS "student_digital_passes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "pass_token" text NOT NULL UNIQUE,
  "status" text DEFAULT 'ACTIVE' NOT NULL, -- 'ACTIVE' | 'REVOKED' | 'EXPIRED'
  "issued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "idx_digital_passes_school" ON "student_digital_passes"("school_id");
CREATE INDEX IF NOT EXISTS "idx_digital_passes_token" ON "student_digital_passes"("pass_token");
