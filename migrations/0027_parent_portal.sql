-- Migration 0027: Parent & Guardian Portal

CREATE TABLE IF NOT EXISTS "student_guardians" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "guardian_name" text NOT NULL,
  "guardian_email" text NOT NULL,
  "relationship" text NOT NULL, -- 'FATHER' | 'MOTHER' | 'TUTOR' | 'OTHER'
  "phone" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_student_guardians_school" ON "student_guardians"("school_id");
CREATE INDEX IF NOT EXISTS "idx_student_guardians_student" ON "student_guardians"("student_id");
