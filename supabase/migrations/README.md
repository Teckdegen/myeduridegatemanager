# Production migrations (run in Supabase SQL Editor, in order)

Run each file **once**, top to bottom. All scripts are idempotent where possible.

| Order | File | Purpose |
|-------|------|---------|
| 1 | `20260522_pilot_features.sql` | Attendance columns, dismissal_date, extra_lessons, **pickup_persons**, **pickup_requests**, notifications `pickup_request` |
| 2 | `20260523_school_classes_list_fix.sql` | `school_classes` columns + teacher FK (admin class list) |
| 3 | `20260524_pickup_notifications.sql` | Notifications type **`pickup_person`** (when parent/admin registers pickup person) |

## Already on production?

- If you ran **#1** before pickup tables were added, re-run **#1** (safe) or run only the `pickup_*` sections from that file.
- **#3** is required for pickup-person alerts in admin/gate Notifications tab.

## No new migration needed for

- Monthly attendance (students + staff) — app-only, uses existing `attendance_records` and `staff_attendance`.
- Parent pickup form with photo — uses `pickup_persons` + `pickup_person_students` from **#1**.
