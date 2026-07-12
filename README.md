# FLN — Assessment Answer Key & Template Generator (MERN)

This branch builds the **AI-powered Assessment Answer Key & Template Generator** feature using a **pure MERN** stack (MongoDB + Express + React + Node).

## Folder layout

```
frontend/   ← React + Vite + Tailwind v4  (port 5173)
backend/    ← Express + MongoDB API       (port 5000)
SRS.md      ← Upstream Software Requirements
```

## Prerequisites

- Node 18+ and npm
- MongoDB running locally (`mongod` or Docker)

## Setup

```bash
# 1. Backend
cd backend
cp .env.example .env       # then edit values if needed
npm install
npm run seed:superadmin    # creates superadmin@fln.org / Welcome1!
npm run dev                # http://localhost:5000

# 2. Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                # http://localhost:5173
```

## Default credentials

| Role | Email | Password |
|---|---|---|
| Super Admin | `superadmin@fln.org` | `Welcome1!` |

## Status

- [x] MERN scaffold
- [x] Superadmin login (JWT + role check)
- [x] Superadmin overview dashboard
- [ ] Pending: Assessment CRUD + AI template builder
- [ ] Pending: Answer key generator