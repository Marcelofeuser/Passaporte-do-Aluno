CREATE TABLE IF NOT EXISTS "communication_category" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "school"("id") ON DELETE CASCADE,
  "name" text NOT NULL, "color" text, "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "communication_category_school_name_uq" UNIQUE ("school_id", "name")
);
CREATE TABLE IF NOT EXISTS "announcement" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "school_id" uuid NOT NULL REFERENCES "school"("id") ON DELETE CASCADE,
  "category_id" uuid NOT NULL REFERENCES "communication_category"("id"), "title" text NOT NULL, "body" text NOT NULL,
  "priority" text NOT NULL DEFAULT 'NORMAL', "publish_at" timestamptz NOT NULL DEFAULT now(), "expires_at" date,
  "created_by" text, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "announcement_school_publish_idx" ON "announcement" ("school_id", "publish_at");
CREATE TABLE IF NOT EXISTS "announcement_audience" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "school_id" uuid NOT NULL REFERENCES "school"("id") ON DELETE CASCADE,
  "announcement_id" uuid NOT NULL REFERENCES "announcement"("id") ON DELETE CASCADE, "audience_type" text NOT NULL,
  "class_id" uuid, "academic_year_id" uuid, "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "announcement_audience_school_idx" ON "announcement_audience" ("school_id", "audience_type", "class_id", "academic_year_id");
CREATE TABLE IF NOT EXISTS "announcement_read" (
  "school_id" uuid NOT NULL REFERENCES "school"("id") ON DELETE CASCADE,
  "announcement_id" uuid NOT NULL REFERENCES "announcement"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "read_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("announcement_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "announcement_read_school_idx" ON "announcement_read" ("school_id", "read_at");
