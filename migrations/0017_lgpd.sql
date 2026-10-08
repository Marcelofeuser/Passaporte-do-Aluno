-- Migration 0017: LGPD Compliance & Data Requests

CREATE TABLE IF NOT EXISTS "lgpd_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "requester_email" text NOT NULL,
  "request_type" text NOT NULL, -- 'EXPORT' | 'ANONYMIZE'
  "status" text DEFAULT 'PENDING' NOT NULL, -- 'PENDING' | 'COMPLETED' | 'REJECTED'
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "idx_lgpd_requests_school" ON "lgpd_requests"("school_id");
