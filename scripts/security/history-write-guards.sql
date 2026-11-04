-- Executed after migrations 0012 and 0013 against PostgreSQL.
\set ON_ERROR_STOP on

BEGIN;

INSERT INTO class (id, school_id, name) VALUES
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000001', 'Turma antiga');
INSERT INTO academic_year (id, school_id, name) VALUES
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000001', 'Ano antigo');
INSERT INTO class_subject (id, school_id, teacher_id) VALUES
  ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000001', 'professor-1');
INSERT INTO subject (id, school_id, name) VALUES
  ('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000001', 'Matemática');
INSERT INTO occurrence_type (id, school_id, name) VALUES
  ('00000000-0000-4000-8000-000000000305', '00000000-0000-4000-8000-000000000001', 'Ocorrência');

INSERT INTO enrollment (id, school_id, student_id, class_id, academic_year_id)
VALUES ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000302');
INSERT INTO school_enrollments (id, school_id, student_id)
VALUES ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101');
INSERT INTO student_parent (student_id, parent_id)
VALUES ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000501');
INSERT INTO student_document (id, school_id, student_id)
VALUES ('00000000-0000-4000-8000-000000000403', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101');
INSERT INTO student_attendance (id, school_id, student_id, status)
VALUES ('00000000-0000-4000-8000-000000000404', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'present');
INSERT INTO academic_history (id, school_id, student_id, notes)
VALUES ('00000000-0000-4000-8000-000000000405', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'Histórico inicial');

INSERT INTO assessment (id, school_id, class_subject_id, subject_id, max_score)
VALUES ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000304', 10);
INSERT INTO assessment_score (id, school_id, assessment_id, student_id, enrollment_id, score)
VALUES ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000401', 8);
INSERT INTO attendance_session (id, school_id, class_subject_id, content)
VALUES ('00000000-0000-4000-8000-000000000603', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000303', 'Aula antiga');
INSERT INTO attendance_record (id, school_id, session_id, student_id, enrollment_id, status)
VALUES ('00000000-0000-4000-8000-000000000604', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000603', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000401', 'PRESENT');

INSERT INTO occurrence (id, school_id, student_id, type_id, description)
VALUES ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000305', 'Registro original');
INSERT INTO occurrence_alert_sent (id, school_id, student_id)
VALUES ('00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101');
INSERT INTO score_change (id, school_id, score_id, reason)
VALUES ('00000000-0000-4000-8000-000000000703', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000602', 'Correção anterior');
INSERT INTO attendance_change (id, school_id, record_id, reason)
VALUES ('00000000-0000-4000-8000-000000000704', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000604', 'Correção anterior');
INSERT INTO occurrence_change (id, school_id, occurrence_id, reason)
VALUES ('00000000-0000-4000-8000-000000000705', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000701', 'Correção anterior');

DO $$
DECLARE
  passport_id uuid;
BEGIN
  SELECT passport_id INTO passport_id
  FROM student WHERE id = '00000000-0000-4000-8000-000000000101';

  INSERT INTO student_transfer (passport_id, from_school_id, to_school_id, from_student_id, requested_by)
  VALUES (passport_id, '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000101', 'school-admin');

  INSERT INTO student (id, school_id, passport_id, full_name)
  VALUES ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000002', passport_id, 'Aluno transferido');

  UPDATE enrollment SET status = 'TRANSFERRED'
  WHERE id = '00000000-0000-4000-8000-000000000401';

  UPDATE student_passport
  SET current_school_id = '00000000-0000-4000-8000-000000000002',
      current_student_id = '00000000-0000-4000-8000-000000000102'
  WHERE id = passport_id;

  UPDATE student_transfer
  SET status = 'ACCEPTED',
      to_student_id = '00000000-0000-4000-8000-000000000102',
      resolved_by = 'destination-admin',
      resolved_at = now()
  WHERE passport_id = passport_id AND status = 'PENDING';
END
$$;

COMMIT;

CREATE OR REPLACE FUNCTION pg_temp.assert_blocked(statement text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE statement;
  RAISE EXCEPTION 'Expected database guard to reject: %', statement USING ERRCODE = 'P0001';
EXCEPTION
  WHEN SQLSTATE '42501' THEN RETURN;
END;
$$;

BEGIN;

SELECT pg_temp.assert_blocked($q$UPDATE student SET full_name = 'alterado' WHERE id = '00000000-0000-4000-8000-000000000101'$q$);
SELECT pg_temp.assert_blocked($q$UPDATE student_document SET deleted_at = now() WHERE id = '00000000-0000-4000-8000-000000000403'$q$);
SELECT pg_temp.assert_blocked($q$UPDATE enrollment SET status = 'ACTIVE' WHERE id = '00000000-0000-4000-8000-000000000401'$q$);
SELECT pg_temp.assert_blocked($q$UPDATE school_enrollments SET status = 'approved' WHERE id = '00000000-0000-4000-8000-000000000402'$q$);
SELECT pg_temp.assert_blocked($q$DELETE FROM student_parent WHERE student_id = '00000000-0000-4000-8000-000000000101'$q$);
SELECT pg_temp.assert_blocked($q$UPDATE student_attendance SET status = 'absent' WHERE id = '00000000-0000-4000-8000-000000000404'$q$);
SELECT pg_temp.assert_blocked($q$UPDATE academic_history SET notes = 'alterado' WHERE id = '00000000-0000-4000-8000-000000000405'$q$);
SELECT pg_temp.assert_blocked($q$UPDATE assessment_score SET score = 10 WHERE id = '00000000-0000-4000-8000-000000000602'$q$);
SELECT pg_temp.assert_blocked($q$UPDATE attendance_record SET status = 'ABSENT' WHERE id = '00000000-0000-4000-8000-000000000604'$q$);
SELECT pg_temp.assert_blocked($q$UPDATE occurrence SET description = 'alterado' WHERE id = '00000000-0000-4000-8000-000000000701'$q$);
SELECT pg_temp.assert_blocked($q$DELETE FROM occurrence_alert_sent WHERE id = '00000000-0000-4000-8000-000000000702'$q$);
SELECT pg_temp.assert_blocked($q$UPDATE assessment SET max_score = 20 WHERE id = '00000000-0000-4000-8000-000000000601'$q$);
SELECT pg_temp.assert_blocked($q$UPDATE attendance_session SET content = 'alterado' WHERE id = '00000000-0000-4000-8000-000000000603'$q$);
SELECT pg_temp.assert_blocked($q$UPDATE class SET name = 'alterada' WHERE id = '00000000-0000-4000-8000-000000000301'$q$);
SELECT pg_temp.assert_blocked($q$UPDATE academic_year SET name = 'alterado' WHERE id = '00000000-0000-4000-8000-000000000302'$q$);
SELECT pg_temp.assert_blocked($q$UPDATE class_subject SET teacher_id = 'outro-professor' WHERE id = '00000000-0000-4000-8000-000000000303'$q$);
SELECT pg_temp.assert_blocked($q$UPDATE subject SET name = 'outra' WHERE id = '00000000-0000-4000-8000-000000000304'$q$);
SELECT pg_temp.assert_blocked($q$UPDATE occurrence_type SET name = 'alterado' WHERE id = '00000000-0000-4000-8000-000000000305'$q$);
SELECT pg_temp.assert_blocked($q$UPDATE score_change SET reason = 'alterado' WHERE id = '00000000-0000-4000-8000-000000000703'$q$);
SELECT pg_temp.assert_blocked($q$DELETE FROM attendance_change WHERE id = '00000000-0000-4000-8000-000000000704'$q$);
SELECT pg_temp.assert_blocked($q$UPDATE occurrence_change SET reason = 'alterado' WHERE id = '00000000-0000-4000-8000-000000000705'$q$);
SELECT pg_temp.assert_blocked($q$UPDATE student_passport SET current_school_id = '00000000-0000-4000-8000-000000000003' WHERE current_student_id = '00000000-0000-4000-8000-000000000102'$q$);

-- Current school remains writable for its own newly created records.
UPDATE student SET full_name = 'Aluno atualizado pela escola atual'
WHERE id = '00000000-0000-4000-8000-000000000102';
INSERT INTO student_document (id, school_id, student_id)
VALUES ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000102');

ROLLBACK;
