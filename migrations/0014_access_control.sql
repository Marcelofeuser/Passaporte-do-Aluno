-- migrations/0014_access_control.sql

CREATE TABLE IF NOT EXISTS access_device (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES school(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    device_key_hash TEXT NOT NULL UNIQUE,
    location TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS student_credential (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES school(id) ON DELETE CASCADE,
    student_id UUID NOT NULL UNIQUE REFERENCES student(id) ON DELETE CASCADE,
    nfc_card_uid TEXT,
    facial_profile_id TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    consent_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS student_credential_nfc_uniq ON student_credential(nfc_card_uid);
CREATE UNIQUE INDEX IF NOT EXISTS student_credential_facial_uniq ON student_credential(facial_profile_id);

CREATE TABLE IF NOT EXISTS student_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES school(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
    device_id UUID REFERENCES access_device(id) ON DELETE SET NULL,
    method VARCHAR(20) NOT NULL,
    type VARCHAR(20) NOT NULL,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS student_access_log_school_time ON student_access_log(school_id, occurred_at);
CREATE INDEX IF NOT EXISTS student_access_log_student_time ON student_access_log(student_id, occurred_at);
