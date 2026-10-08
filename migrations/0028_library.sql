-- Migration 0028: Library & Book Lending Management

CREATE TABLE IF NOT EXISTS "library_books" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "author" text NOT NULL,
  "isbn" text,
  "total_copies" integer DEFAULT 1 NOT NULL,
  "available_copies" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "book_loans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "book_id" uuid NOT NULL REFERENCES "library_books"("id") ON DELETE CASCADE,
  "borrower_name" text NOT NULL,
  "due_date" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'ACTIVE' NOT NULL, -- 'ACTIVE' | 'RETURNED' | 'OVERDUE'
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_library_books_school" ON "library_books"("school_id");
CREATE INDEX IF NOT EXISTS "idx_book_loans_school" ON "book_loans"("school_id");
