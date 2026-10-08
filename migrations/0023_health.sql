-- Migration 0023: School Health & Clinic Management

CREATE TABLE IF NOT EXISTS "student_health_visits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "symptoms" text NOT NULL,
  "treatment_given" text,
  "nurse_notes" text,
  "visited_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_health_visits_school" ON "student_health_visits"("school_id");
CREATE INDEX IF NOT EXISTS "idx_health_visits_student" ON "student_health_visits"("student_id");
