-- Minimal PostgreSQL fixture for migrations 0012 and 0013.
-- This validates the production migration SQL and database-level write guards.

CREATE TABLE school (id uuid PRIMARY KEY);
CREATE TABLE student (
  id uuid PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES school(id),
  passport_id uuid,
  full_name text NOT NULL DEFAULT 'Aluno'
);
CREATE TABLE student_parent (student_id uuid NOT NULL, parent_id uuid NOT NULL);
CREATE TABLE student_document (id uuid PRIMARY KEY, school_id uuid NOT NULL, student_id uuid NOT NULL, deleted_at timestamptz);
CREATE TABLE enrollment (id uuid PRIMARY KEY, school_id uuid NOT NULL, student_id uuid NOT NULL, class_id uuid, academic_year_id uuid, status text NOT NULL DEFAULT 'ACTIVE');
CREATE TABLE school_enrollments (id uuid PRIMARY KEY, school_id uuid NOT NULL, student_id uuid NOT NULL);
CREATE TABLE student_attendance (id uuid PRIMARY KEY, school_id uuid NOT NULL, student_id uuid NOT NULL, status text);
CREATE TABLE academic_history (id uuid PRIMARY KEY, school_id uuid NOT NULL, student_id uuid NOT NULL, notes text);
CREATE TABLE assessment (id uuid PRIMARY KEY, school_id uuid NOT NULL, class_subject_id uuid, subject_id uuid, max_score numeric);
CREATE TABLE assessment_score (id uuid PRIMARY KEY, school_id uuid NOT NULL, assessment_id uuid NOT NULL, student_id uuid NOT NULL, enrollment_id uuid NOT NULL, score numeric);
CREATE TABLE attendance_session (id uuid PRIMARY KEY, school_id uuid NOT NULL, class_subject_id uuid, content text);
CREATE TABLE attendance_record (id uuid PRIMARY KEY, school_id uuid NOT NULL, session_id uuid NOT NULL, student_id uuid NOT NULL, enrollment_id uuid NOT NULL, status text);
CREATE TABLE score_change (id uuid PRIMARY KEY, school_id uuid NOT NULL, score_id uuid NOT NULL, reason text);
CREATE TABLE attendance_change (id uuid PRIMARY KEY, school_id uuid NOT NULL, record_id uuid NOT NULL, reason text);
CREATE TABLE occurrence_type (id uuid PRIMARY KEY, school_id uuid NOT NULL, name text);
CREATE TABLE occurrence (id uuid PRIMARY KEY, school_id uuid NOT NULL, student_id uuid NOT NULL, type_id uuid NOT NULL, description text);
CREATE TABLE occurrence_change (id uuid PRIMARY KEY, school_id uuid NOT NULL, occurrence_id uuid NOT NULL, reason text);
CREATE TABLE occurrence_alert_sent (id uuid PRIMARY KEY, school_id uuid NOT NULL, student_id uuid NOT NULL);

CREATE TABLE class (id uuid PRIMARY KEY, school_id uuid NOT NULL, name text);
CREATE TABLE academic_year (id uuid PRIMARY KEY, school_id uuid NOT NULL, name text);
CREATE TABLE class_subject (id uuid PRIMARY KEY, school_id uuid NOT NULL, teacher_id uuid);
CREATE TABLE subject (id uuid PRIMARY KEY, school_id uuid NOT NULL, name text);

INSERT INTO school (id) VALUES
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000003');

INSERT INTO student (id, school_id, full_name)
VALUES ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'Aluno de teste');
