-- 0012_student_history_protection.sql
-- Stable school-to-school identity and database-enforced write ownership.
-- Existing student rows receive one distinct passport each; no name/CPF matching is performed.

CREATE TABLE IF NOT EXISTS student_passport (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  current_school_id uuid NOT NULL REFERENCES school(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_passport_record (
  passport_id uuid NOT NULL REFERENCES student_passport(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL UNIQUE REFERENCES student(id) ON DELETE RESTRICT,
  school_id uuid NOT NULL REFERENCES school(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (passport_id, school_id)
);

-- Preserve every existing local identity as its own passport.
INSERT INTO student_passport (id, current_school_id)
SELECT s.id, s.school_id
FROM student s
ON CONFLICT (id) DO NOTHING;

INSERT INTO student_passport_record (passport_id, student_id, school_id)
SELECT s.id, s.id, s.school_id
FROM student s
ON CONFLICT (student_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS student_passport_record_school_idx
  ON student_passport_record (school_id, student_id);

CREATE TABLE IF NOT EXISTS student_transfer_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_id uuid NOT NULL REFERENCES student_passport(id) ON DELETE RESTRICT,
  from_school_id uuid NOT NULL REFERENCES school(id) ON DELETE RESTRICT,
  to_school_id uuid NOT NULL REFERENCES school(id) ON DELETE RESTRICT,
  destination_student_id uuid REFERENCES student(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED')),
  reason text NOT NULL,
  requested_by text NOT NULL,
  decided_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CHECK (from_school_id <> to_school_id)
);

CREATE INDEX IF NOT EXISTS student_transfer_pending_idx
  ON student_transfer_request (to_school_id, status, created_at DESC);

-- Students created after this migration receive an independent passport automatically.
CREATE OR REPLACE FUNCTION pa_create_student_passport_record()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  new_passport_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO student_passport (id, current_school_id)
  VALUES (new_passport_id, NEW.school_id);
  INSERT INTO student_passport_record (passport_id, student_id, school_id)
  VALUES (new_passport_id, NEW.id, NEW.school_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pa_student_passport_after_insert ON student;
CREATE TRIGGER pa_student_passport_after_insert
AFTER INSERT ON student
FOR EACH ROW EXECUTE FUNCTION pa_create_student_passport_record();

-- Check both old and new ownership for updates, so changing IDs/school IDs cannot bypass the lock.
CREATE OR REPLACE FUNCTION pa_guard_student_history_write()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  old_student_id uuid;
  old_school_id uuid;
  new_student_id uuid;
  new_school_id uuid;
  owner_school_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'student' THEN
    IF TG_OP <> 'INSERT' THEN
      old_student_id := OLD.id;
      old_school_id := OLD.school_id;
      SELECT p.current_school_id INTO owner_school_id
      FROM student_passport_record r
      JOIN student_passport p ON p.id = r.passport_id
      WHERE r.student_id = old_student_id;
      IF owner_school_id IS DISTINCT FROM old_school_id THEN
        RAISE EXCEPTION 'Student history is read-only for this school'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    IF TG_OP <> 'DELETE' THEN
      new_student_id := NEW.id;
      new_school_id := NEW.school_id;
      SELECT p.current_school_id INTO owner_school_id
      FROM student_passport_record r
      JOIN student_passport p ON p.id = r.passport_id
      WHERE r.student_id = new_student_id;
      IF owner_school_id IS DISTINCT FROM new_school_id THEN
        RAISE EXCEPTION 'Student history is read-only for this school'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    old_student_id := OLD.student_id;
    old_school_id := OLD.school_id;
    SELECT p.current_school_id INTO owner_school_id
    FROM student_passport_record r
    JOIN student_passport p ON p.id = r.passport_id
    WHERE r.student_id = old_student_id;
    IF owner_school_id IS DISTINCT FROM old_school_id THEN
      RAISE EXCEPTION 'Student history is read-only for this school'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    new_student_id := NEW.student_id;
    new_school_id := NEW.school_id;
    SELECT p.current_school_id INTO owner_school_id
    FROM student_passport_record r
    JOIN student_passport p ON p.id = r.passport_id
    WHERE r.student_id = new_student_id;
    IF owner_school_id IS DISTINCT FROM new_school_id THEN
      RAISE EXCEPTION 'Student history is read-only for this school'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS pa_student_history_write_guard ON student;
CREATE TRIGGER pa_student_history_write_guard
BEFORE UPDATE OR DELETE ON student
FOR EACH ROW EXECUTE FUNCTION pa_guard_student_history_write();

DROP TRIGGER IF EXISTS pa_student_document_write_guard ON student_document;
CREATE TRIGGER pa_student_document_write_guard
BEFORE INSERT OR UPDATE OR DELETE ON student_document
FOR EACH ROW EXECUTE FUNCTION pa_guard_student_history_write();

DROP TRIGGER IF EXISTS pa_enrollment_write_guard ON enrollment;
CREATE TRIGGER pa_enrollment_write_guard
BEFORE INSERT OR UPDATE OR DELETE ON enrollment
FOR EACH ROW EXECUTE FUNCTION pa_guard_student_history_write();

DROP TRIGGER IF EXISTS pa_student_attendance_write_guard ON student_attendance;
CREATE TRIGGER pa_student_attendance_write_guard
BEFORE INSERT OR UPDATE OR DELETE ON student_attendance
FOR EACH ROW EXECUTE FUNCTION pa_guard_student_history_write();

DROP TRIGGER IF EXISTS pa_assessment_score_write_guard ON assessment_score;
CREATE TRIGGER pa_assessment_score_write_guard
BEFORE INSERT OR UPDATE OR DELETE ON assessment_score
FOR EACH ROW EXECUTE FUNCTION pa_guard_student_history_write();

DROP TRIGGER IF EXISTS pa_attendance_record_write_guard ON attendance_record;
CREATE TRIGGER pa_attendance_record_write_guard
BEFORE INSERT OR UPDATE OR DELETE ON attendance_record
FOR EACH ROW EXECUTE FUNCTION pa_guard_student_history_write();

DROP TRIGGER IF EXISTS pa_academic_history_write_guard ON academic_history;
CREATE TRIGGER pa_academic_history_write_guard
BEFORE INSERT OR UPDATE OR DELETE ON academic_history
FOR EACH ROW EXECUTE FUNCTION pa_guard_student_history_write();

-- Once a transferred student's record is in an assessment/session, its context is frozen too.
CREATE OR REPLACE FUNCTION pa_guard_historical_assessment_context()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  has_transferred_student boolean;
BEGIN
  IF TG_TABLE_NAME = 'assessment' THEN
    SELECT EXISTS (
      SELECT 1
      FROM assessment_score s
      JOIN student_passport_record r ON r.student_id = s.student_id
      JOIN student_passport p ON p.id = r.passport_id
      WHERE s.assessment_id = OLD.id
        AND p.current_school_id <> OLD.school_id
    ) INTO has_transferred_student;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM attendance_record a
      JOIN student_passport_record r ON r.student_id = a.student_id
      JOIN student_passport p ON p.id = r.passport_id
      WHERE a.session_id = OLD.id
        AND p.current_school_id <> OLD.school_id
    ) INTO has_transferred_student;
  END IF;
  IF has_transferred_student THEN
    RAISE EXCEPTION 'Historical assessment context is read-only'
      USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS pa_assessment_context_write_guard ON assessment;
CREATE TRIGGER pa_assessment_context_write_guard
BEFORE UPDATE OR DELETE ON assessment
FOR EACH ROW EXECUTE FUNCTION pa_guard_historical_assessment_context();

DROP TRIGGER IF EXISTS pa_attendance_session_context_write_guard ON attendance_session;
CREATE TRIGGER pa_attendance_session_context_write_guard
BEFORE UPDATE OR DELETE ON attendance_session
FOR EACH ROW EXECUTE FUNCTION pa_guard_historical_assessment_context();

-- Audit/change logs are append-only; corrections must be separate, auditable records.
CREATE OR REPLACE FUNCTION pa_reject_history_log_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Historical change logs are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS pa_score_change_immutable ON score_change;
CREATE TRIGGER pa_score_change_immutable
BEFORE UPDATE OR DELETE ON score_change
FOR EACH ROW EXECUTE FUNCTION pa_reject_history_log_mutation();

DROP TRIGGER IF EXISTS pa_attendance_change_immutable ON attendance_change;
CREATE TRIGGER pa_attendance_change_immutable
BEFORE UPDATE OR DELETE ON attendance_change
FOR EACH ROW EXECUTE FUNCTION pa_reject_history_log_mutation();
