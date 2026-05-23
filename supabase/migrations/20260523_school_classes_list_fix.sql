-- ============================================
-- Fix school_classes listing for school admin
-- Safe to re-run on production.
-- ============================================

-- Columns used by /api/data get_classes and /api/classes
ALTER TABLE school_classes ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE school_classes ADD COLUMN IF NOT EXISTS assigned_teacher_id UUID;
ALTER TABLE school_classes ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE school_classes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

UPDATE school_classes SET is_active = TRUE WHERE is_active IS NULL;
UPDATE school_classes SET sort_order = 0 WHERE sort_order IS NULL;

-- FK so teacher embeds work in API tools (optional; does not block list)
ALTER TABLE school_classes
  DROP CONSTRAINT IF EXISTS school_classes_assigned_teacher_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_classes_assigned_teacher_id_fkey'
  ) THEN
    ALTER TABLE school_classes
      ADD CONSTRAINT school_classes_assigned_teacher_id_fkey
      FOREIGN KEY (assigned_teacher_id) REFERENCES teacher_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

SELECT 'Migration 20260523_school_classes_list_fix applied.' AS status;
