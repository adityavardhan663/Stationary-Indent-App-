# Stationary-Indent-App-
System that replaces the paper register in a college stationery store. Faculty, staff and department heads request items on their phone, confirm with the phone's fingerprint sensor instead of a handwritten signature, and the store keeper issues the items from a web dashboard. Stocks are updated and reports are generated automatically.

---

## Architecture & Workflows

### 1. Counter Issue Queue (Phase 5A)
In `admin-web`, the Counter Issue Queue manages pending handover of approved stationery requisitions:
- **Urgency Levels**: `Urgent`, `Normal`, and `Not urgent` (defaults safely to `Normal` if missing or unrecognized).
- **Deterministic Sorting**:
  1. Priority order: `Urgent` (1), `Normal` (2), `Not urgent` (3).
  2. Earliest valid `neededBy` first; missing or invalid dates placed last.
  3. Equal priority and date tie-breaker: newest `createdAt` first (descending).
  4. Final tie-breaker: original input array order.
- **Date Normalization**: Target dates (`neededBy`) are parsed in UTC to prevent calendar day shifts across timezones. Supports ISO date-only (`YYYY-MM-DD`), ISO datetime, and human-readable dates (`DD MMM YYYY`). Impossible calendar dates (such as `2026-02-30`) are safely rejected and treated as missing.
- **Data Safety**: All queue sorting and normalization routines are purely non-mutating.

### 2. Development Demo Staff Account Seeding (Phase 5B)
A dedicated script creates a demo `staff` user for development testing:
- **Script**: `npm run seed:demo --prefix backend` (`node backend/src/scripts/seedDemoStaff.js`)
- **Required Guards** (ALL must hold, otherwise script refuses execution):
  - `NODE_ENV=development` (strictly refuses execution in `production` or other environments).
  - `ALLOW_DEMO_SEED=true` (explicit opt-in flag).
  - `DEMO_STAFF_PASSWORD=<password>` (password provided exclusively via environment variable; never hardcoded or logged).
  - `MONGO_URI=<connection-string>` (must be configured; in-memory fallback is refused).
  - Target database must point to `localhost` or `127.0.0.1`. Remote databases (such as MongoDB Atlas) are strictly refused unless `ALLOW_REMOTE_DEMO_SEED=true` is also explicitly set.
- **Security**: The script never prints or logs the URI, host, or password.
- **Idempotency**: Safely creates the user when absent using `User.create`. Never overwrites or resets existing accounts, passwords, roles, or device registrations. Duplicate key error (`11000`) and concurrency collisions are treated cleanly as skipped.

### 3. Repository & Environment Safety (Phase 5C)
- `.gitignore` is hardened against sensitive files:
  - Backup files: `*.bak`, `*.backup`, `.expo-backup/`.
  - Environment files: `.env`, `.env.*`.
  - Example templates tracked: `!.env.example`, `!**/.env.example`.
- Secrets must never be committed or logged.
