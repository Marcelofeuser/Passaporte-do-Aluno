-- Migration 0024: School Inventory & Asset Management

CREATE TABLE IF NOT EXISTS "school_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "item_name" text NOT NULL,
  "category" text NOT NULL, -- 'IT_EQUIPMENT' | 'FURNITURE' | 'BOOKS' | 'SPORTS' | 'OTHER'
  "quantity" integer DEFAULT 1 NOT NULL,
  "condition" text DEFAULT 'GOOD' NOT NULL, -- 'GOOD' | 'FAIR' | 'MAINTENANCE' | 'DAMAGED'
  "location" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_school_assets_school" ON "school_assets"("school_id");
