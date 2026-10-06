-- Fase 8: Gestão de biblioteca e empréstimos. Execute no Neon/Postgres após as migrações anteriores.
-- Todas as tabelas possuem school_id (isolamento multi-tenant). Script idempotente.

ALTER TABLE school ADD COLUMN IF NOT EXISTS library_loan_days integer NOT NULL DEFAULT 14;
ALTER TABLE school ADD COLUMN IF NOT EXISTS library_max_renewals integer NOT NULL DEFAULT 2;
ALTER TABLE school ADD COLUMN IF NOT EXISTS library_max_loans integer NOT NULL DEFAULT 3;
ALTER TABLE school ADD COLUMN IF NOT EXISTS library_fine_per_day numeric(8,2) NOT NULL DEFAULT 0;
ALTER TABLE school ADD COLUMN IF NOT EXISTS library_block_overdue boolean NOT NULL DEFAULT true;
ALTER TABLE school ADD COLUMN IF NOT EXISTS library_due_alert_days integer NOT NULL DEFAULT 2;

CREATE TABLE IF NOT EXISTS book (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  title text NOT NULL,
  authors text NOT NULL,
  isbn text,
  publisher text,
  category text,
  published_year integer,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS book_school_idx ON book(school_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS book_copy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES book(id) ON DELETE CASCADE,
  code text NOT NULL,
  condition text NOT NULL DEFAULT 'GOOD',
  status text NOT NULL DEFAULT 'AVAILABLE',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS book_copy_book_idx ON book_copy(school_id, book_id);
-- Código de tombo único por escola (entre exemplares não baixados).
CREATE UNIQUE INDEX IF NOT EXISTS book_copy_school_code_uq ON book_copy(school_id, lower(code)) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS book_loan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  copy_id uuid NOT NULL REFERENCES book_copy(id) ON DELETE RESTRICT,
  book_id uuid NOT NULL REFERENCES book(id) ON DELETE RESTRICT,
  borrower_type text NOT NULL CHECK (borrower_type IN ('STUDENT', 'TEACHER')),
  student_id uuid REFERENCES student(id) ON DELETE RESTRICT,
  teacher_id uuid REFERENCES teacher(id) ON DELETE RESTRICT,
  loaned_on date NOT NULL,
  due_on date NOT NULL,
  returned_on date,
  status text NOT NULL DEFAULT 'ACTIVE',
  renewals integer NOT NULL DEFAULT 0,
  late_days integer NOT NULL DEFAULT 0,
  fine_amount numeric(10,2) NOT NULL DEFAULT 0,
  fine_status text NOT NULL DEFAULT 'NONE',
  return_condition text,
  notes text,
  due_alert_sent_at timestamptz,
  overdue_alert_sent_at timestamptz,
  created_by text,
  closed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((borrower_type = 'STUDENT' AND student_id IS NOT NULL) OR (borrower_type = 'TEACHER' AND teacher_id IS NOT NULL)),
  CHECK (due_on >= loaned_on)
);
CREATE INDEX IF NOT EXISTS book_loan_school_status_idx ON book_loan(school_id, status, due_on);
CREATE INDEX IF NOT EXISTS book_loan_student_idx ON book_loan(school_id, student_id);
CREATE INDEX IF NOT EXISTS book_loan_teacher_idx ON book_loan(school_id, teacher_id);
-- Um exemplar só pode ter um empréstimo ativo.
CREATE UNIQUE INDEX IF NOT EXISTS book_loan_active_copy_uq ON book_loan(copy_id) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS book_loan_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES book_loan(id) ON DELETE CASCADE,
  kind text NOT NULL,
  old_due_on date,
  new_due_on date,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS book_loan_event_loan_idx ON book_loan_event(school_id, loan_id, created_at);
