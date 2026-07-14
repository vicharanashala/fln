# Architecture

High-level architecture of the FLN platform. See [AUDIT.md](AUDIT.md) for code-health detail and [MIGRATION_PLAN.md](MIGRATION_PLAN.md) for the target direction.

> ⚠️ **Read this first:** the app currently runs on an **in-browser mock backend**, not the real server. Every `/api` call is answered inside the browser from `localStorage`. The real backend exists and works but the UI only reaches it for the few routes the mock doesn't implement (via the Vite proxy). This is the single most important thing to understand about the system today.

---

## 1. Current state (as-is)

```mermaid
flowchart TB
    subgraph Browser["🌐 Browser (localhost:5173)"]
        UI["React App (@fln/frontend)<br/>App.tsx · RoleDashboards · PanelViews<br/>role-based dashboards, workflows"]
        Interceptor{{"fetch() interceptor<br/>(src/mock/fetchInterceptor.ts)"}}
        MockDB[("localStorage<br/>mock DB<br/>(src/mock/dbStore.ts)")]
        Seed["constants.ts<br/>763 ln seed data<br/>(incl. answer keys + PII)"]

        UI -->|"every /api/* call"| Interceptor
        Interceptor -->|"handled routes<br/>(most of the app)"| MockDB
        Seed -.seeds.-> MockDB
    end

    subgraph Vite["Vite dev server :5173"]
        Proxy["/api, /output, /worksheets<br/>proxy"]
    end

    subgraph Backend["🖥️ backend/ — @fln/backend (Express, :3000)"]
        API["index.ts (1580 ln monolith)<br/>auth · students · worksheets<br/>evaluation · analytics · governance"]
        Locks["generation-lock +<br/>defaulter escalation"]
        JsonDB[("data/db.json<br/>single JSON file<br/>(NOT MongoDB)")]
        Puppeteer["Puppeteer<br/>HTML → A4 PDF"]
        Templates["worksheet templates<br/>(frontend/public/worksheets)"]
        API --- Locks
        API --> JsonDB
        API --> Puppeteer
        Puppeteer --> Templates
    end

    subgraph AI["🐍 ai-services/ (Python)"]
        Pipeline["run_pipeline.py<br/>classify → compare →<br/>evaluate → report → assign_level"]
        Prompts["prompts/ · syllabus/ · questions/"]
        Pipeline --- Prompts
    end

    Gemini["☁️ Google Gemini API"]

    Interceptor -->|"UNhandled routes<br/>(real PDF / bulk diagnostic)<br/>fall through to network"| Proxy
    Proxy --> API
    API -->|"execSync (per submission)"| Pipeline
    API -->|"LLM calls (with fallback)"| Gemini
    Pipeline -->|"LLM calls"| Gemini

    classDef active fill:#dcfce7,stroke:#16a34a,color:#000
    classDef dormant fill:#fee2e2,stroke:#dc2626,color:#000
    classDef external fill:#e0e7ff,stroke:#4f46e5,color:#000
    class UI,Interceptor,MockDB,Seed active
    class API,Locks,JsonDB,Puppeteer,Templates,Pipeline,Prompts dormant
    class Gemini,Proxy external
```

**Legend:** 🟢 green = the path the running app actually uses · 🔴 red = real backend, mostly bypassed by the UI · 🟣 purple = external / plumbing.

**Key facts the diagram encodes**
- The **mock interceptor is the de-facto backend.** It serves nearly the whole app from `localStorage`.
- The **real backend is only reached** when the mock doesn't implement a route (e.g. real PDF generation), which then falls through the Vite proxy to `:3000`.
- **Business logic is triplicated** — mock, real backend, and re-computed inside React components — and the copies disagree (e.g. level placement).
- The **"database" is a single JSON file** rewritten per mutation (not concurrency-safe).
- **Auth is not real** — the token is the user's email; role is inferred from the email prefix.

---

## 2. Role hierarchy (domain)

```mermaid
flowchart TD
    SA["Superadmin — national<br/>owns curriculum + calendar"]
    A["Admin — state/UT"]
    DA["District Admin"]
    BA["Block Admin"]
    S["School (Principal)"]
    T["Teacher"]
    V["Volunteer"]
    Students(["Students"])

    SA --> A --> DA --> BA
    BA --> S
    BA -.manages account.-> V
    S --> T
    T --> Students
    V -.serves.-> S

    subgraph tier["same execution tier (generate papers · conduct exam)"]
        S
        T
        V
    end
```

---

## 3. Assessment data flow (per cycle)

```mermaid
flowchart LR
    Base["Baseline / Mid / End<br/>assessment"] --> Gen["AI-personalized<br/>worksheet gen"]
    Gen --> Print["HTML → A4 PDF<br/>(print window)"]
    Print --> Exam["Exam window"]
    Exam --> Scan["ICR scan<br/>(structured JSON)"]
    Scan --> Eval["Python evaluation<br/>(score + report)"]
    Eval --> Level["FLN level<br/>assigned / updated"]
    Level -->|"drives next"| Gen
    Level --> Dash["dashboards roll up<br/>class → national"]
```

---

## 4. Target state (where the migration is headed)

```mermaid
flowchart TB
    subgraph FE["🌐 frontend/ (React)"]
        UI2["Role dashboards + features"]
        Client["apiClient.ts<br/>(single fetch wrapper + auth)"]
        UI2 --> Client
    end

    subgraph BE["🖥️ backend/ (Express, modular)"]
        Auth["auth (real JWT + bcrypt)"]
        Modules["modules/<domain><br/>students · worksheets · evaluation<br/>governance · analytics · content"]
        DB[("real DB<br/>(Mongo/Postgres)<br/>behind repo interface")]
        Auth --> Modules --> DB
    end

    AI2["🐍 ai-services/ (Python pipeline)"]
    Gemini2["☁️ Gemini"]

    Client -->|"HTTPS /api"| Auth
    Modules --> AI2
    Modules --> Gemini2
    AI2 --> Gemini2

    Note["mock deleted · logic lives once on the backend<br/>· no answer keys / PII in the bundle"]

    classDef good fill:#dcfce7,stroke:#16a34a,color:#000
    class UI2,Client,Auth,Modules,DB,AI2 good
```

**Deltas from current → target:** delete the mock; frontend talks only to the real backend via `apiClient`; real auth; real database behind a repository interface; the 1580-line `index.ts` split into domain modules; business logic and secrets (answer keys, PII) removed from the frontend.
