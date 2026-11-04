-- 0014_super_admin_and_authenticator_security.sql
-- Restrict the platform administrator identity and add Better Auth TOTP storage.

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "twoFactorEnabled" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "twoFactor" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "secret" text NOT NULL,
  "backupCodes" text NOT NULL,
  "verified" boolean NOT NULL DEFAULT false,
  "failedVerificationCount" integer NOT NULL DEFAULT 0,
  "lockedUntil" timestamptz
);

CREATE INDEX IF NOT EXISTS "twoFactor_userId_idx" ON "twoFactor" ("userId");

CREATE TABLE IF NOT EXISTS user_security (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  must_change_password boolean NOT NULL DEFAULT false,
  bootstrap_password_issued_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO user_security (user_id, must_change_password)
SELECT id, true
FROM "user"
WHERE lower(email) = lower('MarceloFeuser.go@gmail.com')
ON CONFLICT (user_id) DO UPDATE
SET must_change_password = true,
    bootstrap_password_issued_at = NULL,
    updated_at = now();

-- Existing Super Admin memberships outside the approved identity lose the role.
UPDATE school_membership sm
SET deleted_at = coalesce(sm.deleted_at, now()),
    updated_at = now()
WHERE sm.role = 'SUPER_ADMIN'
  AND (sm.school_id IS NOT NULL OR NOT EXISTS (
    SELECT 1 FROM "user" u
    WHERE u.id = sm.user_id
      AND lower(u.email) = lower('MarceloFeuser.go@gmail.com')
  ));

-- Keep exactly one active global membership for the approved account.
WITH ranked AS (
  SELECT sm.id, row_number() OVER (ORDER BY sm.created_at, sm.id) AS position
  FROM school_membership sm
  JOIN "user" u ON u.id = sm.user_id
  WHERE sm.role = 'SUPER_ADMIN'
    AND sm.deleted_at IS NULL
    AND sm.school_id IS NULL
    AND lower(u.email) = lower('MarceloFeuser.go@gmail.com')
)
UPDATE school_membership sm
SET deleted_at = now(),
    updated_at = now()
FROM ranked
WHERE sm.id = ranked.id AND ranked.position > 1;

INSERT INTO school_membership (user_id, school_id, role)
SELECT u.id, NULL, 'SUPER_ADMIN'
FROM "user" u
WHERE lower(u.email) = lower('MarceloFeuser.go@gmail.com')
  AND NOT EXISTS (
    SELECT 1 FROM school_membership sm
    WHERE sm.user_id = u.id
      AND sm.role = 'SUPER_ADMIN'
      AND sm.school_id IS NULL
      AND sm.deleted_at IS NULL
  );

CREATE OR REPLACE FUNCTION pa_guard_super_admin_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role = 'SUPER_ADMIN' AND (
    NEW.school_id IS NOT NULL
    OR NOT EXISTS (
      SELECT 1 FROM "user" u
      WHERE u.id = NEW.user_id
        AND lower(u.email) = lower('MarceloFeuser.go@gmail.com')
    )
  ) THEN
    RAISE EXCEPTION 'SUPER_ADMIN is reserved for the approved platform identity'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pa_super_admin_identity_guard ON school_membership;
CREATE TRIGGER pa_super_admin_identity_guard
BEFORE INSERT OR UPDATE OF user_id, school_id, role ON school_membership
FOR EACH ROW EXECUTE FUNCTION pa_guard_super_admin_identity();

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_super_admin
ON school_membership (role)
WHERE role = 'SUPER_ADMIN' AND deleted_at IS NULL;
