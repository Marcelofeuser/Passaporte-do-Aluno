-- Migration 0030: School Discipline & Incident Management

CREATE TABLE IF NOT EXISTS "school_incidents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "incident_type" text NOT NULL, -- 'PRAISE' | 'MINOR_INFRACTION' | 'MAJOR_INFRACTION' | 'WARNING'
  "description" text NOT NULL,
  "action_taken" text,
  "reported_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_school_incidents_school" ON "school_incidents"("school_id");
CREATE INDEX IF NOT EXISTS "idx_school_incidents_student" ON "school_incidents"("student_id");
