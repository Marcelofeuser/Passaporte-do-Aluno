CREATE TABLE IF NOT EXISTS student_achievement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES school(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES student(id) ON DELETE RESTRICT,
  passport_id UUID NOT NULL REFERENCES student_passport(id) ON DELETE RESTRICT,
  category TEXT NOT NULL CHECK (category IN (
    'ACADEMIC', 'SPORTS', 'ARTS', 'SCIENCE', 'SOCIAL',
    'TECHNOLOGY', 'LANGUAGES', 'OTHER'
  )),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 3 AND 2000),
  achieved_on DATE NOT NULL,
  evidence_pathname TEXT,
  evidence_content_type TEXT,
  evidence_size_bytes INTEGER,
  recorded_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT student_achievement_evidence_path_check CHECK (
    evidence_pathname IS NULL OR evidence_pathname LIKE ('schools/' || school_id::text || '/achievements/' || student_id::text || '/%')
  ),
  CONSTRAINT student_achievement_evidence_complete CHECK (
    (evidence_pathname IS NULL AND evidence_content_type IS NULL AND evidence_size_bytes IS NULL)
    OR
    (evidence_pathname IS NOT NULL AND evidence_content_type IS NOT NULL
     AND evidence_content_type IN ('image/png', 'image/jpeg', 'image/webp', 'application/pdf')
     AND evidence_size_bytes IS NOT NULL
     AND evidence_size_bytes BETWEEN 1 AND 10485760)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_id_school_passport
  ON student (id, school_id, passport_id);

DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_achievement_student_passport_fk') THEN
    ALTER TABLE student_achievement
      ADD CONSTRAINT student_achievement_student_passport_fk
      FOREIGN KEY (student_id, school_id, passport_id)
      REFERENCES student (id, school_id, passport_id) ON DELETE RESTRICT;
  END IF;
END;
$migration$;

CREATE INDEX IF NOT EXISTS idx_student_achievement_student_date
  ON student_achievement (school_id, student_id, achieved_on DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_achievement_passport_date
  ON student_achievement (passport_id, achieved_on DESC, created_at DESC);

-- Keep achievement records append-only and block writes after a student transfer.
DROP TRIGGER IF EXISTS pa_achievement_history_guard ON student_achievement;
CREATE TRIGGER pa_achievement_history_guard
BEFORE INSERT OR UPDATE OR DELETE ON student_achievement
FOR EACH ROW EXECUTE FUNCTION pa_guard_student_history_write();

CREATE OR REPLACE FUNCTION pa_reject_student_achievement_mutation()
RETURNS trigger LANGUAGE plpgsql AS $
BEGIN
  RAISE EXCEPTION 'Achievement records are append-only'
    USING ERRCODE = '42501';
END;
$;

DROP TRIGGER IF EXISTS pa_achievement_append_only_guard ON student_achievement;
CREATE TRIGGER pa_achievement_append_only_guard
BEFORE UPDATE OR DELETE ON student_achievement
FOR EACH ROW EXECUTE FUNCTION pa_reject_student_achievement_mutation();
