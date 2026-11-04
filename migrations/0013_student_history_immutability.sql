-- 0013_student_history_immutability.sql
-- The application must never let a former school alter a student's records.
-- These database triggers enforce the same rule even when an action is missed.
-- A historical correction is an append-only support addendum; original rows stay intact.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_passport_school_fk') THEN
    ALTER TABLE student_passport
      ADD CONSTRAINT student_passport_school_fk
      FOREIGN KEY (current_school_id) REFERENCES school(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_passport_student_fk') THEN
    ALTER TABLE student_passport
      ADD CONSTRAINT student_passport_student_fk
      FOREIGN KEY (current_student_id) REFERENCES student(id) ON DELETE RESTRICT
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_passport_record_fk') THEN
    ALTER TABLE student
      ADD CONSTRAINT student_passport_record_fk
      FOREIGN KEY (passport_id) REFERENCES student_passport(id) ON DELETE RESTRICT
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_transfer_passport_fk') THEN
    ALTER TABLE student_transfer
      ADD CONSTRAINT student_transfer_passport_fk
      FOREIGN KEY (passport_id) REFERENCES student_passport(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM student WHERE passport_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot protect student history while some students have no passport';
  END IF;
END;
$$;

ALTER TABLE student ALTER COLUMN passport_id SET NOT NULL;

CREATE OR REPLACE FUNCTION pa_student_passport_owner_for(p_student_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT p.current_school_id
  FROM student s
  JOIN student_passport p ON p.id = s.passport_id
  WHERE s.id = p_student_id
$$;

CREATE OR REPLACE FUNCTION pa_guard_student_history_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
      owner_school_id := pa_student_passport_owner_for(old_student_id);
      IF owner_school_id IS DISTINCT FROM old_school_id THEN
        RAISE EXCEPTION 'Transferred student history is read-only for the former school'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    IF TG_OP <> 'DELETE' THEN
      new_student_id := NEW.id;
      new_school_id := NEW.school_id;
      SELECT current_school_id INTO owner_school_id
      FROM student_passport WHERE id = NEW.passport_id;
      IF owner_school_id IS DISTINCT FROM new_school_id
        AND NOT EXISTS (
          SELECT 1 FROM student_transfer t
          WHERE t.passport_id = NEW.passport_id
            AND t.from_school_id = owner_school_id
            AND t.to_school_id = new_school_id
            AND t.status = 'PENDING'
        )
      THEN
        RAISE EXCEPTION 'Student profile is not owned by this school'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'student_parent' THEN
    IF TG_OP <> 'INSERT' THEN
      old_student_id := OLD.student_id;
      SELECT school_id INTO old_school_id FROM student WHERE id = old_student_id;
      owner_school_id := pa_student_passport_owner_for(old_student_id);
      IF owner_school_id IS DISTINCT FROM old_school_id THEN
        RAISE EXCEPTION 'Transferred student history is read-only for the former school'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    IF TG_OP <> 'DELETE' THEN
      new_student_id := NEW.student_id;
      SELECT school_id INTO new_school_id FROM student WHERE id = new_student_id;
      owner_school_id := pa_student_passport_owner_for(new_student_id);
      IF owner_school_id IS DISTINCT FROM new_school_id THEN
        RAISE EXCEPTION 'Transferred student history is read-only for the former school'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    old_student_id := OLD.student_id;
    old_school_id := OLD.school_id;
    owner_school_id := pa_student_passport_owner_for(old_student_id);
    IF owner_school_id IS DISTINCT FROM old_school_id THEN
      RAISE EXCEPTION 'Transferred student history is read-only for the former school'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_student_id := NEW.student_id;
    new_school_id := NEW.school_id;
    owner_school_id := pa_student_passport_owner_for(new_student_id);
    IF owner_school_id IS DISTINCT FROM new_school_id THEN
      RAISE EXCEPTION 'Transferred student history is read-only for the former school'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Immutable student-specific records, including legacy write paths.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'student',
    'student_parent',
    'student_document',
    'enrollment',
    'school_enrollments',
    'student_attendance',
    'assessment_score',
    'attendance_record',
    'academic_history',
    'occurrence',
    'occurrence_alert_sent'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS pa_history_write_guard ON %I', table_name);
    EXECUTE format(
      'CREATE TRIGGER pa_history_write_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION pa_guard_student_history_write()',
      table_name
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION pa_guard_historical_context_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  locked boolean := false;
BEGIN
  IF TG_TABLE_NAME = 'assessment' THEN
    SELECT EXISTS (
      SELECT 1
      FROM assessment_score x
      JOIN student s ON s.id = x.student_id
      JOIN student_passport p ON p.id = s.passport_id
      WHERE x.assessment_id = OLD.id AND p.current_school_id <> OLD.school_id
    ) INTO locked;
  ELSIF TG_TABLE_NAME = 'attendance_session' THEN
    SELECT EXISTS (
      SELECT 1
      FROM attendance_record x
      JOIN student s ON s.id = x.student_id
      JOIN student_passport p ON p.id = s.passport_id
      WHERE x.session_id = OLD.id AND p.current_school_id <> OLD.school_id
    ) INTO locked;
  ELSIF TG_TABLE_NAME = 'class' THEN
    SELECT EXISTS (
      SELECT 1 FROM enrollment e
      JOIN student s ON s.id = e.student_id
      JOIN student_passport p ON p.id = s.passport_id
      WHERE e.class_id = OLD.id AND p.current_school_id <> e.school_id
    ) INTO locked;
  ELSIF TG_TABLE_NAME = 'academic_year' THEN
    SELECT EXISTS (
      SELECT 1 FROM enrollment e
      JOIN student s ON s.id = e.student_id
      JOIN student_passport p ON p.id = s.passport_id
      WHERE e.academic_year_id = OLD.id AND p.current_school_id <> e.school_id
    ) INTO locked;
  ELSIF TG_TABLE_NAME = 'class_subject' THEN
    SELECT EXISTS (
      SELECT 1
      FROM assessment a
      JOIN assessment_score x ON x.assessment_id = a.id
      JOIN student s ON s.id = x.student_id
      JOIN student_passport p ON p.id = s.passport_id
      WHERE a.class_subject_id = OLD.id AND p.current_school_id <> a.school_id
    ) OR EXISTS (
      SELECT 1
      FROM attendance_session a
      JOIN attendance_record x ON x.session_id = a.id
      JOIN student s ON s.id = x.student_id
      JOIN student_passport p ON p.id = s.passport_id
      WHERE a.class_subject_id = OLD.id AND p.current_school_id <> a.school_id
    ) INTO locked;
  ELSIF TG_TABLE_NAME = 'subject' THEN
    SELECT EXISTS (
      SELECT 1
      FROM assessment a
      JOIN assessment_score x ON x.assessment_id = a.id
      JOIN student s ON s.id = x.student_id
      JOIN student_passport p ON p.id = s.passport_id
      WHERE a.subject_id = OLD.id AND p.current_school_id <> a.school_id
    ) INTO locked;
  ELSIF TG_TABLE_NAME = 'occurrence_type' THEN
    SELECT EXISTS (
      SELECT 1
      FROM occurrence o
      JOIN student s ON s.id = o.student_id
      JOIN student_passport p ON p.id = s.passport_id
      WHERE o.type_id = OLD.id AND p.current_school_id <> o.school_id
    ) INTO locked;
  END IF;

  IF locked THEN
    RAISE EXCEPTION 'Context attached to transferred student history is read-only'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DO $
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'assessment', 'attendance_session', 'class', 'academic_year',
    'class_subject', 'subject', 'occurrence_type'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS pa_history_context_guard ON %I', table_name);
    EXECUTE format(
      'CREATE TRIGGER pa_history_context_guard BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION pa_guard_historical_context_write()',
      table_name
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION pa_guard_passport_transfer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.current_school_id IS DISTINCT FROM OLD.current_school_id
     OR NEW.current_student_id IS DISTINCT FROM OLD.current_student_id THEN
    IF NOT EXISTS (
      SELECT 1
      FROM student_transfer t
      JOIN student s ON s.id = NEW.current_student_id
      WHERE t.passport_id = OLD.id
        AND t.from_school_id = OLD.current_school_id
        AND t.from_student_id = OLD.current_student_id
        AND t.to_school_id = NEW.current_school_id
        AND t.status = 'PENDING'
        AND s.school_id = NEW.current_school_id
        AND s.passport_id = OLD.id
    ) THEN
      RAISE EXCEPTION 'Passport ownership can only change through a pending transfer'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pa_passport_owner_transfer_guard ON student_passport;
CREATE TRIGGER pa_passport_owner_transfer_guard
BEFORE UPDATE ON student_passport
FOR EACH ROW EXECUTE FUNCTION pa_guard_passport_transfer();

-- Audit/change rows cannot be edited or deleted, even by the school that created them.
CREATE OR REPLACE FUNCTION pa_reject_history_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Historical change logs are append-only'
    USING ERRCODE = '42501';
END;
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'score_change', 'attendance_change', 'occurrence_change'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS pa_immutable_history_log ON %I', table_name);
    EXECUTE format(
      'CREATE TRIGGER pa_immutable_history_log BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION pa_reject_history_log_mutation()',
      table_name
    );
  END LOOP;
END;
$$;

-- Keep every local profile bound to the passport's current owner or a completed transfer.
CREATE OR REPLACE FUNCTION pa_validate_student_passport_record()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  current_school uuid;
  current_student uuid;
BEGIN
  SELECT current_school_id, current_student_id
  INTO current_school, current_student
  FROM student_passport
  WHERE id = NEW.passport_id;

  IF current_school IS NULL THEN
    RAISE EXCEPTION 'Student passport is missing'
      USING ERRCODE = '23503';
  END IF;

  IF NEW.school_id = current_school AND NEW.id = current_student THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM student_transfer t
    WHERE t.passport_id = NEW.passport_id
      AND t.from_school_id = NEW.school_id
      AND t.from_student_id = NEW.id
      AND t.to_school_id = current_school
      AND t.to_student_id = current_student
      AND t.status = 'ACCEPTED'
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Student profile does not match a current owner or accepted transfer'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS pa_validate_student_passport_record ON student;
CREATE CONSTRAINT TRIGGER pa_validate_student_passport_record
AFTER INSERT OR UPDATE ON student
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION pa_validate_student_passport_record();

-- Transfer requests cannot be rewritten or deleted after creation, and can be resolved once.
CREATE OR REPLACE FUNCTION pa_guard_transfer_request_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  current_school uuid;
  current_student uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Transfer requests are retained as audit history'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.status <> 'PENDING'
     OR NEW.passport_id IS DISTINCT FROM OLD.passport_id
     OR NEW.from_school_id IS DISTINCT FROM OLD.from_school_id
     OR NEW.to_school_id IS DISTINCT FROM OLD.to_school_id
     OR NEW.from_student_id IS DISTINCT FROM OLD.from_student_id
     OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
     OR NEW.requested_at IS DISTINCT FROM OLD.requested_at
     OR NEW.status NOT IN ('ACCEPTED', 'REJECTED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Transfer request is immutable except for its one-time decision'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status = 'ACCEPTED' THEN
    SELECT current_school_id, current_student_id
    INTO current_school, current_student
    FROM student_passport
    WHERE id = OLD.passport_id;
    IF current_school IS DISTINCT FROM OLD.to_school_id
       OR current_student IS DISTINCT FROM NEW.to_student_id
       OR NEW.to_student_id IS NULL THEN
      RAISE EXCEPTION 'Accepted transfer must match the passport owner'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  NEW.resolved_at := COALESCE(NEW.resolved_at, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pa_transfer_request_mutation_guard ON student_transfer;
CREATE TRIGGER pa_transfer_request_mutation_guard
BEFORE UPDATE OR DELETE ON student_transfer
FOR EACH ROW EXECUTE FUNCTION pa_guard_transfer_request_mutation();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_transfer_from_school_fk') THEN
    ALTER TABLE student_transfer
      ADD CONSTRAINT student_transfer_from_school_fk
      FOREIGN KEY (from_school_id) REFERENCES school(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_transfer_to_school_fk') THEN
    ALTER TABLE student_transfer
      ADD CONSTRAINT student_transfer_to_school_fk
      FOREIGN KEY (to_school_id) REFERENCES school(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_transfer_from_student_fk') THEN
    ALTER TABLE student_transfer
      ADD CONSTRAINT student_transfer_from_student_fk
      FOREIGN KEY (from_student_id) REFERENCES student(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_transfer_to_student_fk') THEN
    ALTER TABLE student_transfer
      ADD CONSTRAINT student_transfer_to_student_fk
      FOREIGN KEY (to_student_id) REFERENCES student(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pa_validate_transfer_request_create()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  current_school uuid;
  current_student uuid;
BEGIN
  SELECT current_school_id, current_student_id
  INTO current_school, current_student
  FROM student_passport
  WHERE id = NEW.passport_id
  FOR UPDATE;

  IF NEW.status <> 'PENDING'
     OR current_school IS DISTINCT FROM NEW.from_school_id
     OR current_student IS DISTINCT FROM NEW.from_student_id
     OR NEW.from_school_id = NEW.to_school_id THEN
    RAISE EXCEPTION 'Transfer request must start from the passport current school and student'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pa_transfer_request_create_guard ON student_transfer;
CREATE TRIGGER pa_transfer_request_create_guard
BEFORE INSERT ON student_transfer
FOR EACH ROW EXECUTE FUNCTION pa_validate_transfer_request_create();
