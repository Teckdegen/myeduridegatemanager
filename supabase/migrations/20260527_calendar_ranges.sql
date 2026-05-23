-- Date ranges for school calendar (one entry highlights many days)

ALTER TABLE school_non_school_days ADD COLUMN IF NOT EXISTS batch_id UUID;
ALTER TABLE school_non_school_days ADD COLUMN IF NOT EXISTS range_end_date DATE;

CREATE INDEX IF NOT EXISTS idx_school_non_school_days_batch
  ON school_non_school_days(school_id, batch_id);

SELECT 'Migration 20260527_calendar_ranges applied.' AS status;
