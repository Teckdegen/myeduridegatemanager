-- Ensure dismissal_requests uses Lagos calendar date (required for ready-for-pickup queue).
ALTER TABLE dismissal_requests
  ADD COLUMN IF NOT EXISTS dismissal_date DATE;

UPDATE dismissal_requests dr
SET dismissal_date = (
  (dr.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Lagos'
)::date
WHERE dr.dismissal_date IS NULL;

ALTER TABLE dismissal_requests
  ALTER COLUMN dismissal_date SET DEFAULT CURRENT_DATE;

UPDATE dismissal_requests SET dismissal_date = CURRENT_DATE WHERE dismissal_date IS NULL;

ALTER TABLE dismissal_requests
  ALTER COLUMN dismissal_date SET NOT NULL;
