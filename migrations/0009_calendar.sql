-- Fase 9: calendário escolar, dias letivos e horários de atendimento.
-- Script idempotente para PostgreSQL/Neon.

CREATE TABLE IF NOT EXISTS calendar_event_type (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  name text NOT NULL, color text NOT NULL DEFAULT 'BLUE', audience text NOT NULL DEFAULT 'ALL',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS calendar_event_type_school_idx ON calendar_event_type(school_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS calendar_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  type_id uuid NOT NULL REFERENCES calendar_event_type(id) ON DELETE RESTRICT, title text NOT NULL, description text,
  starts_at timestamptz NOT NULL, ends_at timestamptz, location text, is_school_day boolean NOT NULL DEFAULT true,
  created_by text, alert_sent_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS calendar_event_school_date_idx ON calendar_event(school_id, starts_at) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_day (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  day date NOT NULL, is_school_day boolean NOT NULL, reason text, created_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, day)
);

CREATE TABLE IF NOT EXISTS appointment_slot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES teacher(id) ON DELETE SET NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
  capacity integer NOT NULL DEFAULT 1 CHECK (capacity > 0), location text, notes text, created_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS appointment_slot_school_date_idx ON appointment_slot(school_id, starts_at) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS appointment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  slot_id uuid NOT NULL REFERENCES appointment_slot(id) ON DELETE CASCADE, student_id uuid NOT NULL REFERENCES student(id) ON DELETE RESTRICT,
  booked_by text NOT NULL, status text NOT NULL DEFAULT 'BOOKED', notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slot_id, student_id)
);
CREATE INDEX IF NOT EXISTS appointment_school_status_idx ON appointment(school_id, status);