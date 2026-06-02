-- School self-registration approval workflow (safe for live DB).
-- Existing schools default to 'approved' so nothing breaks after deploy.

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS approval_status TEXT;

UPDATE schools
SET approval_status = 'approved'
WHERE approval_status IS NULL;

ALTER TABLE schools
  ALTER COLUMN approval_status SET DEFAULT 'approved';

ALTER TABLE schools
  ALTER COLUMN approval_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'schools_approval_status_check'
  ) THEN
    ALTER TABLE schools
      ADD CONSTRAINT schools_approval_status_check
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;
