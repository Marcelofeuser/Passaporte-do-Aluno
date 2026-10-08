-- migrations/0013_school_events.sql

CREATE TABLE IF NOT EXISTS school_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES school(id) ON DELETE CASCADE,
    class_id UUID REFERENCES class(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subject(id) ON DELETE SET NULL,
    kind VARCHAR(20) NOT NULL DEFAULT 'EVENT',
    title TEXT NOT NULL,
    description TEXT,
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    location TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_school_event_school ON school_event(school_id);
CREATE INDEX IF NOT EXISTS idx_school_event_class ON school_event(class_id);
CREATE INDEX IF NOT EXISTS idx_school_event_starts ON school_event(starts_at);
