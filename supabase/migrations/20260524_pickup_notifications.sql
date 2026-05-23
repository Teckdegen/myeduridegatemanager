-- Extend notification types for pickup person registration
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'arrival', 'departure', 'late', 'dismissal', 'system',
    'pickup_request', 'pickup_person'
  ));

SELECT 'Migration 20260524_pickup_notifications applied.' AS status;
