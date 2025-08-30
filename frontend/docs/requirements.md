# KidsMin Portal — Requirements & Decisions (Living Doc)
**Last updated:** Aug 27, 2025

## 1) Purpose & Scope
- **Goal:** Scheduling & tracking software for kids ministry programs starting with **Royal Rangers (RR)**; expand to **Girls Ministries (GM)** and **Junior Bible Quiz (JBQ)**.
- **Initial focus:** Authentication (invite, login, set/reset, 2FA), user creation, role-based menu, dashboard shell (tabs + calendar).

## 2) Tech Stack & Environments
- **Backend:** Node.js (Express), MySQL 8, JWT, Nodemailer.
- **Frontend:** Angular v20 (standalone) in an **Nx** workspace.
- **Calendar:** FullCalendar (planned), collapsible above tabs.
- **Environments:** `development` (localhost), `production` (TBD).
- **Env files:** Backend loads `backend/.env.<MODE>` (e.g. `.env.development`) or `backend/.env`.

## 3) Organization & Hierarchy
- **Levels:** `DENOMINATION → NATIONAL → REGIONAL → DISTRICT → CHURCH`.
- **Individuals vs Users:** Individual = person record. User = Individual with credentials + roles.

## 4) Roles & Permissions (MVP)
- **Roles:** `CMC`, `CDR`, `POG`, `COACH`, `ADMIN`.
- **Creation powers (initial):**
  - `CMC` & `CDR`: Create Individuals and invite at their current entity scope.
  - `ADMIN`: First system user; system-level admin.
- **Scope rules:**
  - **NATIONAL (CMC/CDR):** Create Individuals @ NATIONAL; create REGIONAL; invite/assign @ REGIONAL.
  - **REGIONAL (CMC/CDR):** Create Individuals @ REGIONAL; create DISTRICT; invite/assign @ DISTRICT.
  - **DISTRICT (CMC/CDR):** Create Individuals @ DISTRICT; create CHURCH; invite/assign @ CHURCH.
  - **CHURCH (CMC/CDR):** Create Individuals @ CHURCH; invite/assign @ CHURCH.
- **TBD:** Exact permissions for `POG`, `COACH`.

## 5) Authentication & Account Lifecycle
- **Password policy:** ≥12 chars, includes upper/lower/number/symbol (client + server enforced).
- **One-time Admin Creation:** `POST /api/auth/create-admin` (only if no ADMIN exists). Creates Individual + Credentials (inactive), assigns ADMIN @ National, emails set-password link.
- **Invite:** `POST /api/auth/invite` (JWT) with `individualId` + `email`. Creates/updates credentials, emails set-password link.
- **Set/Reset:** 
  - `POST /api/auth/request-reset` (non-leaky).
  - `POST /api/auth/set-password` (token + policy) → activates account.
- **Login + 2FA (email emulation for dev, pluggable later):**
  - `POST /api/auth/login` → either `{ token, roles }` **or** `{ status:'2FA_REQUIRED', method:'email', ttlMin, emailMasked }`.
  - `POST /api/auth/2fa/verify` with `{ email, code }` → `{ token, roles }`.
  - **JWT** stored in `localStorage`; interceptor sends `Authorization: Bearer <token>`.

## 6) Frontend UX (MVP)
- **Login:** Email + password; if 2FA required, prompt for 6-digit code (countdown).
- **Set/Reset Password:** Two inputs (password + confirm) with policy help; reads token from querystring.
- **Role Menu (next):** Shows user id, role assignments (`ROLE @ Entity (Level)`), selecting navigates to `/dashboard` with context; logout clears session.
- **Dashboard shell (next):** Shows entity/level/role; collapsible calendar; tabs **RR / GM / JBQ / Other**.

## 7) API Endpoints
- **System:** `GET /api/system/admin-exists` → `{ exists }`
- **Auth:** 
  - `POST /api/auth/create-admin`
  - `POST /api/auth/login`
  - `POST /api/auth/2fa/verify`
  - `POST /api/auth/request-reset`
  - `POST /api/auth/set-password`
  - `POST /api/auth/invite` (JWT)
- **People:** `POST /api/people/individuals` (JWT)

## 8) Backend Structure
backend/
server.js
config.js
db.js
mailer.js
authUtil.js
authMiddleware.js
twofa.js
api/
routes.js
auth.routes.js
system.routes.js
people.routes.js
db/schema.sql

## 9) Database (MySQL 8)
- **IDs:** Most tables use **UUID in `BINARY(16)`** with `UUID_TO_BIN(uuid, 1)`; `denomination.id = BIGINT AUTO_INCREMENT`.
- **Tables:** `denomination`, `entity`, `individual`, `credentials` (+ `phone_e164`, `twofa_enabled`, `twofa_preferred`), `twofactor_challenge` (single-row per user), `role_assignment`.
- **Conveniences:** Triggers to auto-generate UUIDs; views with `BIN_TO_UUID(...,1)`; seeded **Default** denomination + National/Regional/District entities.

## 10) Security & Policies
- Strong password policy; email-only 2FA in dev; production-ready for swapping to third-party 2FA.
- JWT 8h lifespan; CORS dev origin `http://localhost:4200`.
- Email failures don’t rollback DB transactions for admin creation.

## 11) Env Variables (backend/.env.development)
APP_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=...
DB_PASS=...
DB_NAME=kidsmin
JWT_SECRET=...
FRONTEND_URL=http://localhost:4200

BASE_URL=http://localhost:3000

CORS_ORIGIN=http://localhost:4200

SMTP_HOST=...
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM="KidsMin Portal you@example.com
"
TWOFA_ENABLED=true
TWOFA_CHANNEL=email
TWOFA_CODE_TTL_MIN=5
TWOFA_CODE_LENGTH=6

## 12) Acceptance Criteria (MVP)
- Admin creation and email works; set-password activates account.
- Login returns 2FA_REQUIRED when enabled; verify returns token.
- Invite sends email; set/reset honors policy.
- CORS OK from Angular dev; no PII leaks; reset endpoint is non-leaky.

## 13) Open Items
- Pick production 2FA provider; define `POG` and `COACH`; entity creation UI; event model; email templates; audit logging.
