# AutoGarage — Job Card Management System

A production-ready **MERN stack** (MongoDB, Express, React, Node.js) admin dashboard for an automotive service workshop. Manage job cards, estimates, customers, vehicles, service advisors, reports and settings — similar to autorox.in.

> Phase 1: **Admin dashboard only.** A React Native customer app follows in Phase 2.

---

## ✨ Features

- **Job Cards** — Create (draft/finalize), view with status timeline, edit, change status (with notes & audit trail), assign advisors, search/filter/sort/paginate, print.
- **Estimates** — Dynamic parts/labor/other line items, auto tax & discount calculation, Grand Total, draft → pending approval → approved → invoice workflow.
- **Customers / Vehicles** — Lists with search, vehicle registry, service history, duplicate detection.
- **Advisors** — Manage advisors, availability, workload.
- **Dashboard & Analytics** — KPI tiles (active cards, pending approvals, completed today, avg turn-around), status pie, daily trend line, service-type bar, advisor performance.
- **Reports** — Filterable job card report + **CSV export**, advisor performance chart.
- **Settings** — Company profile, default tax rate, currency.
- **Auth & RBAC** — JWT access + refresh tokens, role-based access (Admin, Service Manager, Service Advisor, Viewer).
- **Documents** — Upload/view/delete attachments on a job card (PDF/JPG/PNG/DOC/DOCX, ≤10 MB) via Multer.

---

## 🛠 Tech Stack

| Layer     | Tools |
|-----------|-------|
| Frontend  | React 18, Vite, Material-UI (MUI) v5, Redux Toolkit, React Router v6, Recharts, Axios |
| Backend   | Node.js, Express 4, Mongoose, JWT, express-validator, helmet, cors, morgan, multer, cookie-parser, bcryptjs |
| Database  | MongoDB |

---

## 📁 Project Structure

```
AutoGarage/
  backend/src/
    routes/         # Page-specific URLs, methods and middleware
    controllers/    # HTTP input, status codes, headers and responses
    services/       # Business rules, persistence and shared providers
    models/         # Mongoose schemas
    middleware/     # Authentication, validation, errors and uploads
    config/         # Environment and database configuration
    seed/           # Development data
    app.ts / server.ts
  frontend/src/
    pages/          # React screens and workflows
    components/     # Shared UI
    redux/          # State and API thunks
    services/       # API client and adapters
    store/          # Redux store and typed hooks
```

See [the page-to-API map](backend/src/routes/README.md) for endpoint coverage and the route/controller/service convention.

Stock updates use MongoDB transactions. Configure a replica set or MongoDB Atlas as described in that guide before using stock edits or movements.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (tested on v24) and npm
- MongoDB running locally (default `mongodb://127.0.0.1:27017/autogarage`)

```bash
# 1) Install dependencies (from repo root)
npm --prefix backend install
npm --prefix frontend install

# 2) Configure environment
copy backend\.env.example  backend\.env
copy frontend\.env.example frontend\.env

# 3) Seed the database (optional but recommended)
npm --prefix backend run seed

# 4) Start the backend  -> http://localhost:5000
npm --prefix backend run dev

# 5) Start the frontend -> http://localhost:5173
npm --prefix frontend run dev
```

### Demo login
```
Email:    admin@autorox.in
Password: admin123
```

### Vehicle registry lookup (optional)

`GET /api/vehicles/lookup/:regNo` resolves a registration number in two steps: the workshop's own vehicle master first, then the registry provider configured **on the server**. Keeping the call server-side means the provider key never reaches the browser, and every advisor shares one cached answer per number.

With nothing configured the endpoint answers `NOT_CONFIGURED` and the estimate wizard falls back to its built-in offline adapter, so the workflow stays usable. To use a real provider, set these in `backend/.env`:

| Variable | Example | Notes |
|---|---|---|
| `VEHICLE_REGISTRY_URL` | `https://kyc-api.example.com/api/v1/vehicle/rc/{reg}` | `{reg}` is replaced with the number. Without it the number is appended as a query parameter (GET) or sent in the body (POST). |
| `VEHICLE_REGISTRY_KEY` | `sk_live_…` | Sent as `Authorization: Bearer …` by default. |
| `VEHICLE_REGISTRY_AUTH_STYLE` | `bearer` (default) · `x-api-key` · `basic` · `query` | `basic` uses `VEHICLE_REGISTRY_CLIENT_ID` and `VEHICLE_REGISTRY_CLIENT_SECRET`; `x-api-key` sends the key in `VEHICLE_REGISTRY_AUTH_HEADER`. |
| `VEHICLE_REGISTRY_METHOD` | `GET` (default) · `POST` | |
| `VEHICLE_REGISTRY_PARAM` | `registrationNumber` (default), `id_number`, `rc_number` … | Field name used for the query string or the POST body. |
| `VEHICLE_REGISTRY_TIMEOUT_MS` | `8000` | Upstream calls are abandoned after this. |
| `VEHICLE_REGISTRY_CACHE_TTL_SECONDS` | `86400` | Responses are cached in memory; `0` disables reuse. |

Responses are normalised through field aliases, so Surepass-, Cashfree-, Signzy-, Perfios-, Zoop- and Vahan-shaped payloads all work without code changes. New field names can be added to the alias lists in `backend/src/services/vehicleRegistry.ts`.

### Service list approval & customer notifications (optional)

`POST /api/jobcards/:id/approval/share` mints an opaque token, moves the job card to *Pending Approval* and returns the customer link `${PUBLIC_APP_URL}/approval/:token`. That page needs no login: the customer sees the itemised list (name, HSN/SAC, rate, quantity + unit, discount, tax, total) and either approves it or requests changes. The decision, method and timestamp are written to `approval.history` and the job card audit log.

Sharing works with nothing configured — the link is generated and shown to the advisor — but nothing is transmitted until a relay is set up. `delivery[]` in the response tells you exactly what happened per channel, so the UI never claims a message was sent when it was not.

| Variable | Example | Notes |
|---|---|---|
| `PUBLIC_APP_URL` | `https://garage.example.com` | Base URL for the approval link. Falls back to `CLIENT_URL`. |
| `NOTIFY_WEBHOOK_URL` | `https://relay.example.com/send` | Relay that turns the payload into an SMS / WhatsApp message / email. |
| `NOTIFY_WEBHOOK_TOKEN` | `…` | Sent as `Authorization: Bearer …`. |
| `NOTIFY_SENDER` | `AutoRox` | Sender name passed to the relay. |
| `NOTIFY_TIMEOUT_MS` | `8000` | Delivery calls are abandoned after this. |

The relay receives `{ to, channel, subject, body, link, sender, reference }` per requested channel and should answer 2xx once the message is accepted; Twilio, Gupshup, MSG91, the Meta Cloud API and Resend all fit behind a small relay like that.

Related endpoints: `PATCH /api/jobcards/:id/advance` (record or clear a deposit), `PATCH /api/jobcards/:id/approval` (approved / changes requested / skipped at the desk) and the public `GET /api/public/approvals/:token` + `POST /api/public/approvals/:token/respond`.

### Kitchen-sink script (root package.json)
```bash
npm run install:all
npm run seed
npm run dev:backend
npm run dev:frontend
npm run build:frontend
```
---

## 🔌 API Overview

Base URL: `http://localhost:5000/api`

| Method & Path | Description |
|---------------|-------------|
| `POST /auth/login` · `/auth/refresh-token` · `/auth/logout` · `GET /auth/me` | Authentication |
| `GET/POST /jobcards` · `GET/PUT/DELETE /jobcards/:id` | Job card CRUD |
| `PATCH /jobcards/:id/status` · `PATCH /jobcards/:id/assign-advisor` | Status & advisor |
| `POST/GET/DELETE /jobcards/:id/documents` | Document upload |
| `GET/POST /estimates` · `GET/PUT /estimates/:id` · `PATCH /:id/approve` · `:reject` · `POST /:id/convert-invoice` | Estimates |
| `GET/POST /customers` · `/:id`, `/:id/vehicles`, `/:id/jobcards` | Customers |
| `GET/POST /vehicles` · `/byReg/:regNo`, `/:id` | Vehicles |
| `GET /vehicles/lookup/:regNo` | Vehicle master + registry RC lookup (`workshop` · `registry` · `cache`) |
| `GET/POST /advisors` · `/:id`, `/:id/status`, `/:id/workload` | Advisors |
| `GET /analytics/dashboard` · `/status-distribution` · `/service-type-distribution` · `/advisor-performance` | Analytics |
| `GET /reports/jobcards?format=csv` | Job card report + CSV |
| `GET/PUT /settings` · `/settings/service-types` | Settings |

All routes except `/auth/login` require a `Bearer <accessToken>` header.

---

## 🧪 Validation & Verification

- Backend: all `src/**` files pass `node --check` and ESM import smoke tests.
- Frontend: `npm --prefix frontend run build` compiles successfully.
- MongoDB is required for live end-to-end runs; the seeder populates demo data.

---

## 🗄 Database Schema

Collections: `users`, `advisors`, `customers`, `vehicles`, `jobcards`, `estimates`, `settings`.
Key indexes: `jobcards.jobCardNumber` (unique), `jobcards.vehicle.registrationNumber`, `jobcards.status`, `vehicles.registrationNumber` (unique), `vehicles.vin`, `customers.phone`, `users.email` (unique).

---

## 🔒 Role-based Access (RBAC)

- **Admin** — full access
- **Service Manager** — manage job cards & advisors, view reports
- **Service Advisor** — create/view assigned job cards, update status
- **Viewer** — read-only

`authorize('Admin', ...)` guards sensitive routes (advisors/settings).

---

## 🚀 Deployment Notes

- Configure `.env` with strong `JWT_SECRET` / `JWT_REFRESH_SECRET`.
- Set `NODE_ENV=production` (enables secure httpOnly cookies + disables dev logging).
- Point `CLIENT_URL` at the deployed frontend origin for CORS.
- Serve the built `frontend/dist/` via any static host and proxy `/api` to the backend.

---

## 🤝 License

MIT.