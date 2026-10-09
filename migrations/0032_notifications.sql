-- Migration 0032: School Notifications & Announcements

CREATE TABLE IF NOT EXISTS "school_announcements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "target_role" text DEFAULT 'ALL' NOT NULL, -- 'ALL' | 'TEACHERS' | 'STUDENTS' | 'PARENTS'
  "priority" text DEFAULT 'NORMAL' NOT NULL, -- 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_school_announcements_school" ON "school_announcements"("school_id");
