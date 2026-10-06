-- migrations/0011_student_attendance.sql

CREATE TABLE IF NOT EXISTS student_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES school(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
    class_id UUID REFERENCES class(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'present', -- present, absent, justified, late
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_attendance_school ON student_attendance(school_id);
CREATE INDEX IF NOT EXISTS idx_student_attendance_student ON student_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_student_attendance_class ON student_attendance(class_id);
CREATE INDEX IF NOT EXISTS idx_student_attendance_date ON student_attendance(date);
