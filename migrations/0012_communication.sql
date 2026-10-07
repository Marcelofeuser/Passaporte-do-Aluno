-- migrations/0012_communication.sql

CREATE TABLE IF NOT EXISTS school_announcement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES school(id) ON DELETE CASCADE,
    class_id UUID REFERENCES class(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_school_announcement_school ON school_announcement(school_id);
CREATE INDEX IF NOT EXISTS idx_school_announcement_class ON school_announcement(class_id);
CREATE INDEX IF NOT EXISTS idx_school_announcement_created ON school_announcement(created_at);

CREATE TABLE IF NOT EXISTS announcement_read (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES school(id) ON DELETE CASCADE,
    announcement_id UUID NOT NULL REFERENCES school_announcement(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS announcement_read_uniq ON announcement_read(announcement_id, user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_read_user ON announcement_read(user_id);
