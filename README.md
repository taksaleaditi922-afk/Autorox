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
├── backend/                  # Express + MongoDB API
│   └── src/
│       ├── config/          # env, db
│       ├── controllers/     # route handlers
│       ├── middleware/      # auth, validate, errorHandler, upload
│       ├── models/          # Mongoose schemas
│       ├── routes/          # Express routers
│       ├── seed/            # demo data seeder
│       ├── app.js / server.js
├── frontend/                # React (Vite) admin dashboard
│   └── src/
│       ├── components/      # Layout, badges, loader, toast
│       ├── pages/           # Login, Dashboard, JobCards, JobCardForm,
│       │                    # JobCardDetails, Estimates, Customers,
│       │                    # Vehicles, Advisors, Reports, Settings
│       ├── redux/           # auth, jobCards, ui slices
│       ├── services/        # axios instance + interceptors
│       ├── styles/  utils/  # theme, globals, formatters, constants
│       ├── App.jsx / main.jsx
└── package.json             # root helper scripts
```

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