-- Migration 0020: Teacher Portal & Lesson Plans

CREATE TABLE IF NOT EXISTS "lesson_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "teacher_id" text NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "class_date" date NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_lesson_plans_school" ON "lesson_plans"("school_id");
CREATE INDEX IF NOT EXISTS "idx_lesson_plans_teacher" ON "lesson_plans"("teacher_id");
