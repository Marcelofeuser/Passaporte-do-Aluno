-- Migration 0022: School Transportation & Routes

CREATE TABLE IF NOT EXISTS "school_routes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "route_name" text NOT NULL,
  "driver_name" text NOT NULL,
  "vehicle_plate" text NOT NULL,
  "capacity" integer DEFAULT 30 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_school_routes_school" ON "school_routes"("school_id");
