-- Migration 0018: Notifications System

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "channel" text DEFAULT 'IN_APP' NOT NULL, -- 'IN_APP' | 'EMAIL' | 'PUSH'
  "is_read" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_notifications_school" ON "notifications"("school_id");
CREATE INDEX IF NOT EXISTS "idx_notifications_user" ON "notifications"("user_id");
