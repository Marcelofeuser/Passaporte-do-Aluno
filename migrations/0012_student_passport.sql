CREATE TABLE IF NOT EXISTS student_passport (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    current_school_id UUID NOT NULL,
    current_student_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_transfer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    passport_id UUID NOT NULL,
    from_school_id UUID NOT NULL,
    to_school_id UUID NOT NULL,
    from_student_id UUID NOT NULL,
    to_student_id UUID,
    status TEXT NOT NULL DEFAULT 'PENDING',
    requested_by TEXT NOT NULL,
    resolved_by TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

ALTER TABLE student ADD COLUMN IF NOT EXISTS passport_id UUID;

WITH new_passports AS (
    INSERT INTO student_passport (current_school_id, current_student_id)
    SELECT s.school_id, s.id
    FROM student s
    WHERE s.passport_id IS NULL
    RETURNING id, current_student_id
), linked_students AS (
    UPDATE student s
    SET passport_id = p.id
    FROM new_passports p
    WHERE s.id = p.current_student_id
    RETURNING s.id
)
SELECT COUNT(*)::integer AS linked_students FROM linked_students;

CREATE INDEX IF NOT EXISTS idx_student_passport_id ON student(passport_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_passport_school ON student(passport_id, school_id) WHERE passport_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_passport_current_school ON student_passport(current_school_id);
CREATE INDEX IF NOT EXISTS idx_student_passport_current_student ON student_passport(current_student_id);
CREATE INDEX IF NOT EXISTS idx_student_transfer_to_status ON student_transfer(to_school_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_transfer_from_school ON student_transfer(from_school_id, status);
CREATE INDEX IF NOT EXISTS idx_student_transfer_passport ON student_transfer(passport_id, requested_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_transfer_one_pending_passport ON student_transfer(passport_id) WHERE status = 'PENDING';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_transfer_status_check') THEN
        ALTER TABLE student_transfer ADD CONSTRAINT student_transfer_status_check
            CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_transfer_distinct_schools_check') THEN
        ALTER TABLE student_transfer ADD CONSTRAINT student_transfer_distinct_schools_check
            CHECK (from_school_id <> to_school_id);
    END IF;
END;
$$;
