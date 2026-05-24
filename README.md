# MyEduRide Gate Manager — Technical Reference

School gate management platform: QR/ID scan attendance, teacher dismissal queue, gate release verification, parent notifications, multi-tenant schools.

**Stack:** Next.js 14 App Router · TypeScript · Supabase (Postgres + Auth + Storage) · Resend · Web Push (VAPID) · face-api.js · Vercel

**Deep dive:** [`supabase/migrations/README.md`](supabase/migrations/README.md) (schema ER diagram, extension guide)

---

## Quick start

```bash
npm install
cp .env.local.example .env.local   # fill all keys
# Supabase SQL Editor → run supabase/schema.sql
npm run dev
```

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Middleware session refresh |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | All `/api/*` DB access |
| `RESEND_API_KEY` | server | OTP + transactional email |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | client | Web push subscription |
| `VAPID_PRIVATE_KEY` | server | Web push send |
| `NEXT_PUBLIC_APP_URL` | server | Email deep links |
| `SUPER_ADMIN_EMAILS` | server | Comma-separated bootstrap emails |

**Supabase setup:** Run `supabase/schema.sql` (creates tables, RLS, `photos` bucket). Enable Email auth provider. Bucket is **private** — images served via `/api/photo`.

**Timezone:** Business logic uses `Africa/Lagos` (WAT, UTC+1). DB stores `TIMESTAMPTZ` in UTC. Helpers: `src/lib/timezone.ts`, `src/lib/attendance/lagos-dates.ts`.

---

## Architecture

```
Client (dashboards)
  │  credentials: include
  │  Cookie: myeduride_session (JSON)
  ▼
Next.js Route Handlers  src/app/api/**/route.ts
  │  getSessionFromRequest()  → RBAC
  │  getAdminClient()         → Supabase service role
  ▼
PostgreSQL + Storage (photos bucket)
```

- **No Postgres RPC functions** — all logic in TypeScript route handlers.
- **API routes skip middleware auth** — each handler validates session independently.
- **Photo paths** stored in DB (e.g. `logos/{schoolId}.jpg`); never store public URLs in `logo_url` / `photo_url`.

### Session cookie

**Name:** `myeduride_session` · **TTL:** 7 days · **httpOnly:** false

```json
{
  "user_id": "uuid",
  "email": "user@school.com",
  "full_name": "Jane Doe",
  "roles": [{ "role": "teacher", "school_id": "uuid" }]
}
```

### Roles (`user_school_roles.role`)

| Role | Dashboard path |
|------|----------------|
| `super_admin` | `/dashboard/super-admin` |
| `school_admin` | `/dashboard/school-admin` |
| `teacher` | `/dashboard/teacher` |
| `gate_officer` | `/dashboard/gate` |
| `staff` | `/dashboard/staff` |
| `parent` | `/dashboard/parent` |

---

## Database (summary)

Full DDL: [`supabase/schema.sql`](supabase/schema.sql)

| Table | Writes via | Notes |
|-------|-----------|-------|
| `schools` | schools/* | Tenant root, gate hours, branding |
| `school_classes` | classes, setup | `UNIQUE(school_id, name)` |
| `students` | students/* | `student_id_number`, `qr_code_data` unique |
| `teacher_profiles` | staff/*, ensure-profile | Staff ID + QR (`STF-…`) |
| `user_school_roles` | staff/create, schools/create | RBAC |
| `attendance_records` | gate/accept, teacher/scan | `source`: gate \| teacher |
| `dismissal_requests` | teacher/ready-for-pickup | `UNIQUE(student_id, dismissal_date)` |
| `extra_lessons` | teacher/extra-lesson | `UNIQUE(student_id, date)` |
| `pickup_persons` + `pickup_person_students` | pickup-persons | M:N authorised collectors |
| `pickup_requests` | pickup-requests | Parent → admin messages |
| `notifications` | many routes | In-app inbox |
| `gate_sessions` | gate/session | Links scans to shift |

**Realtime enabled:** `attendance_records`, `dismissal_requests`, `extra_lessons`, `notifications`, `pickup_requests`

---

## HTTP API — complete endpoint reference

**Base:** `{NEXT_PUBLIC_APP_URL}/api`

**Conventions:**
- JSON body unless noted `multipart/form-data`
- Authenticated routes require cookie `myeduride_session` + `credentials: 'include'`
- Errors: `{ "error": "message" }` with standard HTTP status
- All handlers use `export const dynamic = 'force-dynamic'` where applicable (no static cache)

---

### Authentication

#### `POST /api/auth/send-otp`

| | |
|---|---|
| **Auth** | Public |
| **Body** | `{ "email": "string" }` |
| **Success** | `200 { "success": true }` |
| **Errors** | `400` invalid email · `404` no account · `500` OTP insert failed |
| **Side effects** | Invalidates prior OTPs; inserts `otp_codes` (10 min TTL); sends email via Resend |
| **Tables** | `otp_codes`, reads `user_profiles` |

#### `POST /api/auth/verify-otp`

| | |
|---|---|
| **Auth** | Public |
| **Body** | `{ "email": "string", "code": "string" }` |
| **Success** | `200 { success, user, roles[] }` + sets `myeduride_session` cookie |
| **Errors** | `401` invalid/expired code · `404` user not found |
| **Side effects** | Marks OTP used; bootstraps super_admin if email in `SUPER_ADMIN_EMAILS` |
| **Tables** | `otp_codes`, `user_profiles`, `user_school_roles` |

---

### Data hub (RPC-style aggregator)

#### `POST /api/data`

| | |
|---|---|
| **Auth** | Session required |
| **Body** | `{ "action": "string", "params": {} }` |

| Action | Params | Response | Description |
|--------|--------|----------|-------------|
| `get_school_admin_data` | `{ role?: "school_admin" }` | `{ school, school_id }` | Resolve admin's school |
| `get_school_dashboard` | `{ school_id }` | counts, `recent_activity`, `present_today` | Admin overview stats |
| `get_teacher_dashboard` | — | `{ students[], present_count, absent_count, late_count }` | Teacher class list (legacy) |
| `get_teacher_dashboard_full` | — | above + `ready_for_pickup`, `in_extra_lesson`, `dismissal_status` | Teacher dismissal UI |
| `get_staff_dashboard` | — | `{ school_id, school_name, job_title }` | Staff home |
| `get_parent_children` | — | `{ children[] }` with school/class embed | Parent linked students |
| `get_parent_notifications` | — | `{ notifications[] }` | Parent inbox (limit 50) |
| `mark_notification_read` | `{ notification_id }` | `{ success: true }` | Mark one read |
| `get_students` | `{ school_id }` | `{ students[] }` | Active students + class |
| `get_classes` | `{ school_id }` | `{ classes[] }` with `student_count` | Class list |
| `get_custom_fields` | `{ school_id }` | `{ fields[] }` | Dynamic form schema |
| `query` | `{ table, select, filters, order, limit }` | `{ data[] }` | Generic read (internal use) |

**Errors:** `400` unknown action · `401` no session · `500` query timeout (10s)

---

### Schools

#### `GET /api/schools/list`

| | |
|---|---|
| **Auth** | `super_admin` |
| **Query** | `t` (cache buster, optional) |
| **Response** | `{ schools: [{ ...school, student_count, staff_count }], count }` |
| **Notes** | Excludes platform school UUID `00000000-0000-0000-0000-000000000001` |

#### `POST /api/schools/create`

| | |
|---|---|
| **Auth** | `super_admin` |
| **Body** | `{ name, address?, admin_email, admin_name, admin_phone? }` |
| **Response** | `{ success, school_id, school }` |
| **Side effects** | Inserts `schools`, default `school_custom_fields`, default `school_custom_roles`, `user_school_roles` (school_admin), `teacher_profiles` via `ensureStaffProfile`, welcome email |
| **Logo** | Upload separately: `POST /api/schools/logo` |

#### `POST /api/schools/delete`

| | |
|---|---|
| **Auth** | `super_admin` |
| **Body** | `{ school_id }` |
| **Side effects** | Cascading delete via FK on `schools` |

#### `GET /api/schools/settings?school_id=`

| | |
|---|---|
| **Auth** | `school_admin` for school |
| **Response** | `{ school, time_columns_available: boolean }` |

#### `PUT /api/schools/settings`

| | |
|---|---|
| **Auth** | `school_admin` |
| **Body** | `{ school_id, name, address, logo_url, primary_color, secondary_color, gate_open_time, school_start_time, late_threshold, gate_close_time, dismissal_start_time, dismissal_end_time }` |
| **Response** | `{ school, migration_required? }` |
| **Tables** | `schools` |

#### `POST /api/schools/logo`

| | |
|---|---|
| **Auth** | `super_admin` OR `school_admin` for `school_id` |
| **Content-Type** | `multipart/form-data` |
| **Fields** | `school_id`, `file` (JPG/PNG/WebP, max 5 MB) |
| **Response** | `{ success, path, preview_url }` |
| **Side effects** | Uploads to `photos/logos/{schoolId}.{ext}`; updates `schools.logo_url` with storage path |

#### `GET /api/schools/students?school_id=`

| | |
|---|---|
| **Auth** | School staff or `super_admin` |
| **Response** | `{ students[] }` with `class:school_classes` embed |

#### `GET /api/schools/staff?school_id=&ensure_profiles=1`

| | |
|---|---|
| **Auth** | School staff or `super_admin` |
| **Query** | `ensure_profiles=1` — backfill missing `teacher_profiles` + `STF-…` IDs |
| **Response** | `{ staff: [{ id, role, job_title, profile, staff: { staff_id_number, qr_code_data, photo_url } }] }` |
| **Roles returned** | `school_admin`, `teacher`, `gate_officer`, `staff` |

#### `GET /api/schools/custom-roles?school_id=`

| | |
|---|---|
| **Auth** | School staff or `super_admin` |
| **Response** | `{ roles: [{ id, name, slug, can_assign_class, sort_order }] }` |

#### `POST /api/schools/custom-roles`

| | |
|---|---|
| **Auth** | `school_admin` or `super_admin` |
| **Body** | `{ school_id, name, can_assign_class?: boolean }` |
| **Tables** | `school_custom_roles` |

#### `DELETE /api/schools/custom-roles`

| | |
|---|---|
| **Body** | `{ id, school_id }` |

#### `GET /api/schools/calendar?school_id=&from=&to=`

| | |
|---|---|
| **Auth** | School staff |
| **Response** | `{ events[] }` from `school_non_school_days` |

#### `POST /api/schools/calendar`

| | |
|---|---|
| **Body** | `{ school_id, calendar_date, day_type, title, description?, notify_parents?, range_end_date? }` |
| **day_type** | `public_holiday` \| `school_event` \| `closure` |

#### `DELETE /api/schools/calendar`

| | |
|---|---|
| **Body** | `{ id, school_id }` or `{ batch_id, school_id }` |

---

### Classes

#### `GET /api/classes?school_id=`

| | |
|---|---|
| **Auth** | `school_admin` or `super_admin` |
| **Response** | `{ classes: [{ ...row, assigned_teacher, student_count }] }` |

#### `POST /api/classes`

| | |
|---|---|
| **Body** | `{ school_id, name, grade, section?, assigned_teacher_id? }` |
| **Side effects** | May upsert `teacher_class_assignments` if teacher assigned |

#### `PUT /api/classes`

| | |
|---|---|
| **Body** | `{ id, school_id, name?, grade?, section?, assigned_teacher_id? }` |

#### `DELETE /api/classes`

| | |
|---|---|
| **Body** | `{ id, school_id }` |
| **Behavior** | Soft-delete (`is_active: false`); **409** if active students enrolled |

---

### Students

#### `POST /api/students/create`

| | |
|---|---|
| **Auth** | `school_admin` |
| **Body** | `{ school_id, class_id?, first_name, last_name, custom_fields?, photo_base64?, face_descriptor?, parent_email?, parent_name?, parent_phone?, relationship? }` |
| **Response** | `{ success, student }` |
| **Side effects** | Generates `STU-{prefix}-{ts}` ID + QR; uploads photo to `students/{school_id}/{id}.jpg`; creates/links parent user if email provided |
| **Tables** | `students`, `student_parents`, `user_profiles`, `user_school_roles` |

#### `POST /api/students/update`

| | |
|---|---|
| **Body** | `{ student_id, ...fields, photo_base64?, class_id?, custom_fields? }` |

#### `POST /api/students/delete`

| | |
|---|---|
| **Body** | `{ student_id }` |
| **Behavior** | Soft-delete (`is_active: false`) |

---

### Staff

#### `POST /api/staff/create`

| | |
|---|---|
| **Auth** | `school_admin` |
| **Body** | `{ email, full_name, phone?, role, school_id, class_id?, custom_role_id?, custom_fields?, photo_base64?, face_descriptor?, face_photos?, skip_face? }` |
| **role** | `staff` \| `teacher` \| `gate_officer` \| `school_admin` |
| **Validation** | `staff` requires `custom_role_id`; gate_officer requires face photos unless `skip_face`; class assign only for `teacher` or staff role with `can_assign_class` |
| **Side effects** | Auth user + profile + role + `teacher_profiles` (`STF-…` ID, QR, photo); class assignment; welcome email |
| **Tables** | `user_profiles`, `user_school_roles`, `teacher_profiles`, `teacher_class_assignments`, `school_classes` |

#### `POST /api/staff/delete`

| | |
|---|---|
| **Body** | `{ role_id }` — `user_school_roles.id` |
| **Behavior** | Sets `is_active: false` on role row |

#### `POST /api/staff/attendance`

| | |
|---|---|
| **Auth** | `staff` role |
| **Purpose** | Staff self-service attendance view/log from staff dashboard |

---

### Setup wizard

Used when `schools.setup_completed = false`.

#### `POST /api/setup/classes`

| | |
|---|---|
| **Body** | `{ school_id, classes: [{ name, grade? }] }` |
| **Behavior** | **Deletes all existing classes** for school, re-inserts (destructive — wizard only) |

#### `POST /api/setup/fields`

| | |
|---|---|
| **Body** | `{ school_id, fields: [{ entity_type, field_name, field_label, field_type, ... }] }` |
| **Tables** | `school_custom_fields` |

#### `POST /api/setup/complete`

| | |
|---|---|
| **Body** | `{ school_id }` |
| **Side effects** | `schools.setup_completed = true`, `setup_step = 'complete'` |

---

### Gate operations

#### `POST /api/gate/session`

| | |
|---|---|
| **Auth** | `gate_officer` |
| **Body (start)** | `{ action: "start", school_id, mode: "arrival"|"dismissal" }` |
| **Body (end)** | `{ action: "end", session_id }` |
| **Response (start)** | `{ success, session: { id, mode, started_at } }` |
| **Tables** | `gate_sessions` |

#### `GET /api/gate/dashboard?school_id=`

| | |
|---|---|
| **Auth** | `gate_officer`, `school_admin`, `super_admin` |
| **Response** | `{ pickup_queue[], all_students[], pickup_notices[], today_stats, date }` |
| **pickup_queue** | `dismissal_requests` where `status IN (pending, approved)` for Lagos today |
| **Tables read** | `students`, `dismissal_requests`, `pickup_notices`, `attendance_records` |

#### `POST /api/gate/scan`

| | |
|---|---|
| **Auth** | Gate session (implicit via cookie) |
| **Body** | `{ scan_data: "MYEDURIDE:STU-…"|qr|uuid, school_id }` |
| **Response (student)** | `{ type: "student", person: {...}, today: { has_arrival, has_departure }, allowed_actions: { arrival, departure } }` |
| **Response (staff)** | `{ type: "staff", person: {...}, allowed_actions }` |
| **Purpose** | Pre-flight lookup before accept; resolves QR / ID / UUID via `resolveStudentId` / `resolveStaffProfile` |
| **No DB writes** | Read-only |

#### `POST /api/gate/accept`

| | |
|---|---|
| **Auth** | `gate_officer` (session.user_id → `verified_by_user_id`) |
| **Body (student arrival)** | `{ student_id, school_id, type: "arrival", verification_method, gate_session_id? }` |
| **Body (student departure)** | `{ student_id, school_id, type: "departure", verification_method, from_ready_queue: true, gate_session_id? }` |
| **Body (staff)** | `{ person_type: "staff", staff_profile_id, user_id, school_id, type: "arrival"|"departure", verification_method }` |
| **verification_method** | `face_recognition` \| `id_card_scan` \| `manual` |
| **Side effects (arrival)** | Inserts `attendance_records`; computes `status` (on_time/late) + `minutes_late` from `schools.late_threshold`; notifies parents |
| **Side effects (departure)** | Inserts departure record; requires ready queue unless internal bypass; sets `dismissal_requests.status = completed`, `completed_at`; notifies parents |
| **Side effects (staff)** | Inserts `staff_attendance` (clock_in/clock_out) |
| **Errors** | `409` duplicate same-day action · `403` must check in first / not on ready queue |

---

### Teacher

#### `POST /api/teacher/ready-for-pickup`

| | |
|---|---|
| **Auth** | `teacher` or `school_admin` for school |
| **Body** | `{ student_id, school_id, notes? }` |
| **Response** | `{ success, dismissal }` |
| **Errors** | `409` already marked today (`UNIQUE(student_id, dismissal_date)`) |
| **Side effects** | Inserts `dismissal_requests` (pending); clears active `extra_lessons`; email + push + `notifications` to parents; notifies gate officers |
| **Tables** | `dismissal_requests`, `extra_lessons`, `notifications` |

#### `POST /api/teacher/extra-lesson`

| | |
|---|---|
| **Auth** | `teacher` |
| **Body** | `{ student_id, school_id, action: "add"|"release", lesson_end_time? }` |
| **add** | Upserts `extra_lessons` (`is_released: false`) — student excluded from dismissal list |
| **release** | Sets `is_released: true`; internally calls `POST /api/teacher/ready-for-pickup` |
| **Tables** | `extra_lessons`, `dismissal_requests` (on release) |

#### `POST /api/teacher/scan`

| | |
|---|---|
| **Auth** | `teacher` |
| **Body** | `{ scan_data?, student_id?, school_id }` |
| **Side effects** | Inserts `attendance_records` with `source: "teacher"`, `verification_method: "teacher_manual"`, `type: "arrival"`; late detection applied |
| **Purpose** | Classroom attendance for students who missed gate check-in |

---

### Attendance & reports

#### `GET /api/attendance/reports`

| | |
|---|---|
| **Auth** | `school_admin` (all classes), `teacher` (own class), `super_admin` |
| **Query** | `school_id`, `type` (`daily`\|`weekly`\|`monthly`), `date` (YYYY-MM-DD Lagos), `month` (YYYY-MM), `class_id?`, `format` (`json`\|`csv`) |
| **Response (daily)** | Per-student: name, class, check_in, check_out, status, minutes_late |
| **Response (weekly/monthly)** | Summary percentages + per-class aggregates; excludes `school_non_school_days` |
| **Tables read** | `students`, `attendance_records`, `school_non_school_days` |

#### `GET /api/attendance/sign-log?school_id=&date=&entity=`

| | |
|---|---|
| **Auth** | `gate_officer`, `school_admin`, `super_admin` |
| **Query** | `entity`: `all` \| `students` \| `staff` |
| **Response** | `{ entries: [{ entity, name, type, timestamp, time_display, status }] }` |
| **Purpose** | Gate log tab — chronological sign-in/out for students + staff |

#### `GET /api/attendance/export?school_id=&day=&from=&to=`

| | |
|---|---|
| **Auth** | Scoped via `resolveAttendanceAccess` |
| **Response** | `text/csv` attachment |
| **Purpose** | Bulk attendance export for admin |

#### `GET /api/parent/attendance-history`

| | |
|---|---|
| **Auth** | `parent` linked to `student_id` |
| **Query** | `student_id`, `type` (`daily`\|`weekly`\|`monthly`\|`yearly`), `date`, `year`, `term` (1\|2\|3) |
| **Response** | Calendar grid with `status`, `color` (green/yellow/red), check-in/out times, summary stats |

---

### Pickup persons & requests

#### `GET /api/pickup-persons?student_id=` OR `?school_id=`

| | |
|---|---|
| **Auth** | Session (parent for own children; admin for school) |
| **Response** | `{ pickup_persons: [{ id, name, relationship, phone, photo_url }] }` |
| **school_id query** | Includes linked students embed |

#### `POST /api/pickup-persons`

| | |
|---|---|
| **Body** | `{ school_id, name, relationship, phone?, photo_url?, student_ids: [] }` |
| **Side effects** | Inserts `pickup_persons` + `pickup_person_students`; notifies school_admin + gate_officer |
| **Tables** | `pickup_persons`, `pickup_person_students`, `notifications` |

#### `PUT /api/pickup-persons`

| | |
|---|---|
| **Body** | `{ id, name?, relationship?, phone?, photo_url?, student_ids? }` |

#### `DELETE /api/pickup-persons`

| | |
|---|---|
| **Body** | `{ id }` — cascades link rows |

#### `GET /api/pickup-requests?school_id=&date=`

| | |
|---|---|
| **Auth** | `school_admin`, `gate_officer` |
| **Response** | `{ pickup_requests: [{ ..., student, parent }] }` |
| **Purpose** | Admin "Pickup Requests" panel |

#### `POST /api/pickup-requests`

| | |
|---|---|
| **Auth** | `parent` (must be linked to student) |
| **Body** | `{ student_id, pickup_person_name, pickup_person_phone?, message? }` |
| **Side effects** | Inserts `pickup_requests`; in-app + email notification to admin/gate |
| **Tables** | `pickup_requests`, `notifications` |

#### `PATCH /api/pickup-requests`

| | |
|---|---|
| **Body** | `{ id, status: "acknowledged"|"completed" }` |
| **Side effects** | Sets `acknowledged_by`, `acknowledged_at` |

#### `POST /api/parents/pickup-notice`

| | |
|---|---|
| **Auth** | `parent` |
| **Body** | `{ student_id, pickup_person_name, pickup_person_phone?, relationship?, is_self_pickup?, notes? }` |
| **Tables** | `pickup_notices` |

#### `GET /api/parents/pickup-notice?student_id=&date=`

| | |
|---|---|
| **Response** | Today's pickup notice for student |

#### `POST /api/parents/invite`

| | |
|---|---|
| **Auth** | `school_admin` |
| **Body** | `{ student_id, parent_email, parent_name, relationship? }` |
| **Side effects** | Creates parent user + `student_parents` link + invite email |

---

### Notifications & push

#### `GET /api/notifications/inbox?school_id=&limit=`

| | |
|---|---|
| **Auth** | Session (own notifications) |
| **Response** | `{ notifications[], unread_count }` |

#### `PATCH /api/notifications/inbox`

| | |
|---|---|
| **Body** | `{ id }` mark one read · OR `{ mark_all: true, school_id? }` |

#### `POST /api/notifications/attendance`

| | |
|---|---|
| **Purpose** | Internal/server trigger for attendance notification pipeline |
| **Called by** | `gate/accept` via `notifyParentsOfAttendance` |

#### `POST /api/notifications/dismissal`

| | |
|---|---|
| **Status** | **Legacy/orphaned** — superseded by `teacher/ready-for-pickup` |
| **Note** | No active callers in codebase |

#### `POST /api/notifications/absence`

| | |
|---|---|
| **Purpose** | Trigger absence notifications to parents |

#### `POST /api/push/subscribe`

| | |
|---|---|
| **Body** | Web Push subscription object `{ endpoint, keys: { p256dh, auth } }` |
| **Tables** | `push_subscriptions` |

#### `DELETE /api/push/subscribe`

| | |
|---|---|
| **Body** | `{ endpoint }` |

---

### ID cards & media

#### `POST /api/id-card/generate`

| | |
|---|---|
| **Body** | `{ student_id }` OR `{ teacher_id \| staff_id, type: "teacher"|"staff" }` |
| **Response** | `{ card: { type, school_name, name, id_number, qr_code_data, photo_url, ... } }` |
| **Purpose** | Card metadata for client-side PDF (legacy path) |

#### `POST /api/id-cards/download`

| | |
|---|---|
| **Auth** | `super_admin` |
| **Body** | `{ school_id, student_ids?: [], staff_role_ids?: [] }` |
| **Response** | `application/pdf` binary |
| **Side effects** | Calls `ensureStaffProfile` for each staff row before generate |

#### `GET /api/photo?path=` OR `?url=`

| | |
|---|---|
| **Auth** | Public (path required) |
| **Purpose** | Proxy private `photos` bucket via service role |
| **Response** | Image bytes; `Content-Type` inferred from extension (jpeg/png/webp) |
| **Example** | `/api/photo?path=logos/{schoolId}.jpg` |

#### `POST /api/upload`

| | |
|---|---|
| **Auth** | Session |
| **Body** | `{ folder, filename, data: "data:image/jpeg;base64,..." }` |
| **Response** | `{ path }` |
| **Note** | Generic upload — prefer scoped endpoints (`schools/logo`, student/staff create) |

---

### Face enrollment

#### `POST /api/face/enroll`

| | |
|---|---|
| **Body** | `{ entity_type: "student"|"staff", entity_id, descriptor: number[] }` |
| **Side effects** | Updates `face_descriptor` JSONB on `students` or `teacher_profiles` |
| **Purpose** | Store face-api.js embedding for future matching |

---

## Core state machines

### Dismissal (student, per Lagos calendar day)

```
[active class list]
    │ POST /api/teacher/ready-for-pickup
    ▼
dismissal_requests.status = pending  (UNIQUE per student per day)
    │ appears in GET /api/gate/dashboard → pickup_queue
    ▼
POST /api/gate/accept (departure, from_ready_queue)
    ▼
dismissal_requests.status = completed
attendance_records (type: departure)
```

### Extra lesson override

```
POST /api/teacher/extra-lesson { action: "add" }
    → extra_lessons.is_released = false
    → student blocked from ready-for-pickup UI

POST /api/teacher/extra-lesson { action: "release" }
    → extra_lessons.is_released = true
    → auto POST /api/teacher/ready-for-pickup
```

---

## Storage path conventions

| Path | Entity |
|------|--------|
| `logos/{schoolId}.{ext}` | School logo |
| `students/{schoolId}/{studentIdNumber}.jpg` | Student photo |
| `staff/{schoolId}/{staffIdNumber}.jpg` | Staff photo |
| `pickup/{schoolId}/{uuid}.jpg` | Pickup person photo |

Bucket: `photos` · private · max 5 MB · MIME: `image/jpeg`, `image/png`, `image/webp`

---

## Endpoint index (alphabetical)

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/attendance/export` | admin |
| GET | `/api/attendance/reports` | admin, teacher |
| GET | `/api/attendance/sign-log` | gate, admin |
| POST | `/api/auth/send-otp` | public |
| POST | `/api/auth/verify-otp` | public |
| GET/POST/PUT/DELETE | `/api/classes` | admin |
| POST | `/api/data` | session |
| POST | `/api/face/enroll` | admin |
| POST | `/api/gate/accept` | gate |
| GET | `/api/gate/dashboard` | gate, admin |
| POST | `/api/gate/scan` | gate |
| POST | `/api/gate/session` | gate |
| POST | `/api/id-card/generate` | session |
| POST | `/api/id-cards/download` | super_admin |
| GET/PATCH | `/api/notifications/inbox` | session |
| POST | `/api/notifications/absence` | internal |
| POST | `/api/notifications/attendance` | internal |
| POST | `/api/notifications/dismissal` | legacy |
| GET | `/api/parent/attendance-history` | parent |
| POST | `/api/parents/invite` | admin |
| GET/POST | `/api/parents/pickup-notice` | parent |
| GET/POST/PUT/DELETE | `/api/pickup-persons` | parent, admin |
| GET/POST/PATCH | `/api/pickup-requests` | parent, admin |
| GET | `/api/photo` | public |
| POST/DELETE | `/api/push/subscribe` | session |
| GET/POST/DELETE | `/api/schools/calendar` | admin |
| POST | `/api/schools/create` | super_admin |
| GET/POST/DELETE | `/api/schools/custom-roles` | admin |
| POST | `/api/schools/delete` | super_admin |
| GET | `/api/schools/list` | super_admin |
| POST | `/api/schools/logo` | admin, super_admin |
| GET/PUT | `/api/schools/settings` | admin |
| GET | `/api/schools/staff` | staff, admin |
| GET | `/api/schools/students` | staff, admin |
| POST | `/api/setup/classes` | admin (wizard) |
| POST | `/api/setup/complete` | admin (wizard) |
| POST | `/api/setup/fields` | admin (wizard) |
| POST | `/api/staff/attendance` | staff |
| POST | `/api/staff/create` | admin |
| POST | `/api/staff/delete` | admin |
| POST | `/api/students/create` | admin |
| POST | `/api/students/delete` | admin |
| POST | `/api/students/update` | admin |
| POST | `/api/teacher/extra-lesson` | teacher |
| POST | `/api/teacher/ready-for-pickup` | teacher |
| POST | `/api/teacher/scan` | teacher |
| POST | `/api/upload` | session |

---

## Project layout

```
src/app/api/          Route handlers (this document)
src/app/dashboard/    Role-based UI (gate, teacher, parent, school-admin, super-admin)
src/lib/session.ts    Cookie session parse + RBAC helpers
src/lib/supabase/     admin.ts (service role), server.ts, middleware.ts
src/lib/timezone.ts   Lagos date/time utilities
src/lib/types/        TypeScript DB models
supabase/schema.sql   Full Postgres DDL + RLS + storage bucket
```

---

## License

Proprietary — Daisaf Industrial Services Company Limited (DISCL)
