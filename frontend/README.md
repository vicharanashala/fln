# FLN Frontend — National Super Admin Dashboard

React + TypeScript + Vite + Tailwind v4 — the UI for the FLN National Super Admin Dashboard.

See the [root README](../README.md) for full project documentation.

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

Opens on http://localhost:5173.

## Scripts

```bash
npm run dev         # Vite dev server with HMR
npm run build       # tsc -b && vite build (production)
npm run preview     # Preview production build
npm run typecheck   # TypeScript strict mode check
```

## Stack

- **React 18** + **TypeScript 5**
- **Vite 5** for tooling
- **Tailwind CSS v4** for styling
- **React Router 6** for navigation
- **TanStack Query** for data fetching
- **Axios** with JWT interceptor
- **Framer Motion** for animations
- **Recharts** for charts
- **Lucide React** for icons
- **React Hot Toast** for notifications

## Source layout

```
src/
├── main.tsx                    # Providers (QueryClient, Theme, Auth, Toaster)
├── App.tsx                     # Router with 13 routes
├── layouts/DashboardLayout.tsx # Sidebar + Topbar + Breadcrumb shell
├── components/
│   ├── ui/                     # 15 reusable primitives
│   ├── layout/                 # Sidebar, Topbar, Breadcrumb
│   ├── tables/DataTable.tsx
│   └── auth/RequireAuth.tsx
├── contexts/                   # Auth + Theme
├── pages/                      # 13 module pages + Login
├── services/api.ts             # Axios instance
├── types/index.ts              # TypeScript interfaces
├── mocks/data.ts               # India-scale mock data
└── data/indiaMap.ts            # State coordinates + score colors
```

## Design tokens

| Token | Value |
|---|---|
| Primary | `#2563EB` (blue-600) |
| Background | `#F8FAFC` (slate-50) |
| Card | `#FFFFFF` + `border-slate-200` |
| Radius | 12px |
| Shadow | `shadow-sm` / `shadow-md` |
| Font | ui-sans-serif system stack |