-- Migration 0029: School Canteen & Consumption Management

CREATE TABLE IF NOT EXISTS "school_canteen_products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "price" numeric(10,2) NOT NULL,
  "stock" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "student_canteen_purchases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "school_canteen_products"("id") ON DELETE CASCADE,
  "quantity" integer DEFAULT 1 NOT NULL,
  "total_price" numeric(10,2) NOT NULL,
  "purchased_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_canteen_products_school" ON "school_canteen_products"("school_id");
CREATE INDEX IF NOT EXISTS "idx_canteen_purchases_school" ON "student_canteen_purchases"("school_id");
