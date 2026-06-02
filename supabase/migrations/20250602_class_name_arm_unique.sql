-- Allow multiple classes with the same name (e.g. Primary 4) when arm (section) differs.
ALTER TABLE school_classes DROP CONSTRAINT IF EXISTS school_classes_school_id_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS school_classes_school_id_name_section_key
  ON school_classes (school_id, name, COALESCE(section, ''));
