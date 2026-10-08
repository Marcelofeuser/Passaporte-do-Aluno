-- Migration 0016: Documentos e Declarações Escolares (Fase 11)

CREATE TABLE IF NOT EXISTS "issued_document" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "school"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "student"("id") ON DELETE CASCADE,
  "doc_type" text NOT NULL, -- 'ENROLLMENT_DECLARATION' | 'ATTENDANCE_PROOF' | 'PARTIAL_TRANSCRIPT'
  "verification_code" text NOT NULL UNIQUE,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "issued_by" text,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "issued_document_school_time" ON "issued_document"("school_id", "created_at");
CREATE INDEX IF NOT EXISTS "issued_document_student" ON "issued_document"("student_id");
