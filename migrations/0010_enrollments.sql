-- migrations/0010_enrollments.sql

CREATE TABLE IF NOT EXISTS school_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES school(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_year(id) ON DELETE CASCADE,
    class_id UUID REFERENCES class(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending, active, transferred, completed, dropped
    enrollment_type VARCHAR(30) NOT NULL DEFAULT 'new', -- new, renewal, transfer
    contract_accepted BOOLEAN NOT NULL DEFAULT false,
    contract_accepted_at TIMESTAMP,
    financial_cleared BOOLEAN NOT NULL DEFAULT false,
    documents_cleared BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_school_enrollments_school ON school_enrollments(school_id);
CREATE INDEX IF NOT EXISTS idx_school_enrollments_student ON school_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_school_enrollments_year ON school_enrollments(academic_year_id);

CREATE TABLE IF NOT EXISTS academic_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES school(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_year(id) ON DELETE CASCADE,
    grade_level VARCHAR(50) NOT NULL,
    result VARCHAR(30) NOT NULL, -- promoted, retained, transferred
    final_average NUMERIC(5, 2),
    attendance_rate NUMERIC(5, 2),
    institution_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_academic_history_school ON academic_history(school_id);
CREATE INDEX IF NOT EXISTS idx_academic_history_student ON academic_history(student_id);