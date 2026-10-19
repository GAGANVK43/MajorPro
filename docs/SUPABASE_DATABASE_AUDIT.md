# DiaSense AI — Supabase Database Integration & Persistence Audit

**Date:** 2026-10-19  
**System:** DiaSense AI Backend Database Layer  
**Scope:** Supabase PostgreSQL connectivity, pooler status, DNS resolution, local database fallback, schema migration, and operational instructions.

---

## 1. Active Supabase PostgreSQL Integration (VERIFIED LIVE)

The application is now connected directly to active Supabase PostgreSQL:
```env
DATABASE_URL=postgresql://postgres:Gaganvk%405556@db.durulifwvhkafmbldxfp.supabase.co:5432/postgres
```

### Live Connection Verification
- **Host:** `db.durulifwvhkafmbldxfp.supabase.co`
- **Port:** `5432`
- **Database Engine:** `PostgreSQL 17.6 on x86_64-pc-linux-gnu`
- **Active Backend:** `postgresql+psycopg2` (SSL mode: `require`)
- **Status:** **CONNECTED & PERSISTING**

### Confirmed Tables in Supabase
All SQLAlchemy models were successfully initialized in the live Supabase PostgreSQL instance:
- `users` (with `id`, `full_name`, `email`, `password`, `age`, `gender`, `reset_token`, `reset_token_expiry`, `created_at`, `updated_at`)
- `assessments`
- `predictions`
- `diet_plans`
- `contact_messages`

---

## 2. Historical Diagnostics (Previous Paused Project)

Prior to receiving the active database URI, socket and psycopg2 probes diagnosed the legacy database URL (`postgres.zswrgozetsvgblsigqpb`):

| Connection Target | Port | User | Result | Evidence / Log Output |
| :--- | :--- | :--- | :--- | :--- |
| `aws-0-ap-northeast-1.pooler.supabase.com` | `5432` | `postgres.zswrgozetsvgblsigqpb` | **FAIL** | `FATAL: (ENOTFOUND) tenant/user postgres.zswrgozetsvgblsigqpb not found` |
| `aws-0-ap-northeast-1.pooler.supabase.com` | `6543` | `postgres.zswrgozetsvgblsigqpb` | **FAIL** | `FATAL: (ENOTFOUND) tenant/user postgres.zswrgozetsvgblsigqpb not found` |
| `db.zswrgozetsvgblsigqpb.supabase.co` | `5432` | `postgres` | **FAIL** | `[Errno 11001] getaddrinfo failed (DNS name not found)` |

The old project had been paused due to inactivity, triggering the fallback. With the updated credentials, Supabase PostgreSQL is active and confirmed.

---

## 2. Robust Architectural Improvements Made

To guarantee **zero data loss** and absolute stability:

1. **Canonical Database File Anchoring:**
   `database.py` now resolves SQLite to an absolute canonical path anchored directly to the backend directory:
   ```python
   CANONICAL_SQLITE_PATH = Path(__file__).resolve().parent.parent.parent / "diasense.db"
   ```
   Regardless of whether the application is launched from the repository root, `backend/`, or an IDE debugger, it ALWAYS accesses the same database file.

2. **Elimination of Silent Engine Swapping:**
   The double engine re-creation inside `init_db()` was eliminated. The database engine initialized at startup remains consistent across the entire server lifecycle.

3. **Automatic Non-Destructive Migrations:**
   `init_db()` automatically inspects existing tables and applies missing columns (`reset_token`, `reset_token_expiry`) so existing user records are fully preserved without manual SQL execution.

---

## 3. Developer Guide: Restoring Live Supabase PostgreSQL

To switch from the local SQLite database to live Supabase PostgreSQL:

### Step 1: Check Supabase Project Status
1. Navigate to the Supabase Dashboard: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Look for project reference `zswrgozetsvgblsigqpb`.
   - **If Paused:** Click the **"Restore project"** button and wait 1–2 minutes for the database containers to restart.
   - **If Deleted or Expired:** Click **"New Project"**, name it `DiaSense AI`, and set a strong database password.

### Step 2: Retrieve the Connection String
1. In the Supabase project dashboard, navigate to **Project Settings** (gear icon) → **Database**.
2. Scroll to the **Connection string** section.
3. Select **URI** and copy the URI (choose **Session pooler** or **Direct connection**).
4. Replace `[YOUR-PASSWORD]` with your actual Supabase database password. Ensure special characters like `@` are URL-encoded (`%40`).

### Step 3: Update `backend/.env`
Open `backend/.env` and update `DATABASE_URL`:
```env
DATABASE_URL=postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
```

### Step 4: Restart the Backend
Run the backend:
```bash
python run.py
```
Upon startup, the console will log:
```log
INFO: Connected to PostgreSQL database successfully.
INFO: Database tables initialized successfully (postgresql).
```
SQLAlchemy will automatically create all tables (`users`, `assessments`, `predictions`, `diet_plans`, `contacts`) directly in Supabase PostgreSQL.
