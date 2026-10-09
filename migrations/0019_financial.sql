-- Migration 0019: Financial & Tuition Management

CREATE TABLE IF NOT EXISTS "tuition_invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "amount" numeric(10, 2) NOT NULL,
  "due_date" date NOT NULL,
  "status" text DEFAULT 'PENDING' NOT NULL, -- 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  "paid_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tuition_school" ON "tuition_invoices"("school_id");
CREATE INDEX IF NOT EXISTS "idx_tuition_student" ON "tuition_invoices"("student_id");
