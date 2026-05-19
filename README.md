# MyEduRide — Gate Manager

**The Student Safety Platform**

School gate management system with facial recognition, barcode scanning, real-time parent notifications, and multi-school support.

## Tech Stack

- **Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Face Recognition:** face-api.js (TensorFlow.js)
- **Email:** Resend API
- **Push Notifications:** Web Push API (VAPID)
- **Offline:** IndexedDB + Service Worker (PWA)
- **Deployment:** Vercel

## Getting Started

### 1. Clone and install

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor → paste contents of `supabase/schema.sql` → Run
3. Enable Email OTP in Authentication → Providers → Email
4. Create a storage bucket called `photos` (public)

### 3. Set up Resend

1. Create account at [resend.com](https://resend.com)
2. Verify your domain
3. Get API key

### 4. Generate VAPID keys

```bash
npx web-push generate-vapid-keys
```

### 5. Download face-api.js models

Download models from [face-api.js models](https://github.com/justadudewhohacks/face-api.js/tree/master/weights) and place in `public/models/`:
- tiny_face_detector_model-weights_manifest.json
- tiny_face_detector_model-shard1
- face_landmark_68_model-weights_manifest.json
- face_landmark_68_model-shard1
- face_recognition_model-weights_manifest.json
- face_recognition_model-shard1

### 6. Configure environment

Copy `.env.local.example` to `.env.local` and fill in all values.

### 7. Run locally

```bash
npm run dev
```

### 8. Deploy to Vercel

```bash
npx vercel
```

Or connect your GitHub repo to Vercel for automatic deployments.

## Environment Variables (Vercel)

Add these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `RESEND_API_KEY` | Resend API key |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key |
| `VAPID_PRIVATE_KEY` | VAPID private key (server only) |
| `NEXT_PUBLIC_APP_URL` | Your deployed URL (e.g. https://myeduride.vercel.app) |

## Architecture

```
├── src/app/
│   ├── api/              # API routes (serverless functions)
│   ├── auth/             # Login (OTP)
│   ├── dashboard/
│   │   ├── gate/         # Gate officer tablet interface
│   │   ├── parent/       # Parent dashboard
│   │   ├── school-admin/ # School admin (sidebar layout)
│   │   ├── super-admin/  # Platform admin (500 schools)
│   │   └── teacher/      # Teacher class view
│   └── offline/          # Offline fallback
├── src/components/
│   ├── gate/             # Face scanner, ID scanner, verification card
│   ├── setup/            # School setup wizard steps
│   └── shared/           # Sidebar, role switcher, dynamic fields
├── src/lib/
│   ├── offline/          # IndexedDB for offline support
│   ├── push/             # Web push subscribe/send
│   ├── supabase/         # Client, server, middleware
│   └── types/            # TypeScript interfaces
├── supabase/
│   └── schema.sql        # Full database schema with RLS
└── public/
    ├── models/           # face-api.js model weights
    ├── sw.js             # Service worker
    └── manifest.json     # PWA manifest
```

## User Roles

| Role | Access |
|------|--------|
| Super Admin | Manage all 500 schools, create school admins |
| School Admin | Full school management, setup wizard, reports |
| Teacher | View class, mark dismissals |
| Gate Officer | Verify students (face/barcode), log attendance |
| Parent | View all children, receive notifications |

## Key Features

- Email OTP authentication (no passwords)
- Dynamic school setup (each school configures their own classes and data fields)
- Face recognition at gate (face-api.js)
- Barcode/QR scanning for ID cards
- Teacher dismissal → Gate officer release flow
- Real-time parent notifications (email + push)
- Offline-first gate operation
- Multi-school, multi-role support
- School branding (colors, logo)
- CSV bulk import
- PDF ID card generation
- Attendance reports with export

## License

Proprietary — Daisaf Industrial Services Company Limited (DISCL)
