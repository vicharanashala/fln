# Contributing — Team / Intern Guide

Welcome! This is the practical guide for working on the FLN platform. If you read one file, read this one. It tells you how to set up, where code goes, the rules that keep the project clean, and how to ship a change.

---

## 1. Read these, in this order

| # | File | Why |
|---|------|-----|
| 1 | **CONTRIBUTING.md** (this) | how to work |
| 2 | [README.md](README.md) | what the project is + quick start |
| 3 | [CLAUDE.md](CLAUDE.md) | the current architecture + the **one critical warning** (two backends) |
| 4 | [ARCHITECTURE.md](ARCHITECTURE.md) | the same thing as diagrams |
| 5 | [SRS.md](SRS.md) / [PRD.md](PRD.md) | what the product is supposed to do |
| 6 | [AUDIT.md](AUDIT.md) | known problems (paths reflect the old layout — see its banner) |
| 7 | [MIGRATION_PLAN.md](MIGRATION_PLAN.md) | where the codebase is being taken, and in what order |

You don't need to memorize them. Skim 2–4, then come back as needed.

---

## 2. Setup (once)

You need **Node.js 20+**, **npm 10+**, and **Python 3.10+** on your PATH.

```bash
git clone https://github.com/vicharanashala/fln.git
cd fln
npm install                                             # installs frontend + backend
python -m pip install -r ai-services/requirements.txt   # for the evaluation pipeline
```

## 3. Run it (every day)

Two terminals:

```bash
npm run dev:frontend    # the app  → http://localhost:5173   ← this is what you look at
npm run dev:backend     # the API  → http://localhost:3000   (needed for a few features)
```

Log in with a demo account (ask the team for the password). For most screens you only need `dev:frontend`; run `dev:backend` too when you touch anything that hits the real API.

---

## 4. The ONE thing you must understand first

**There are two backends. The app you see runs on a FAKE one.**

- The React app answers its own `/api` calls in the browser from `localStorage` (`frontend/src/mock/`). This is the "mock."
- A **real** backend exists in `backend/` + `ai-services/`, but the UI mostly doesn't call it yet.

So before you "fix the backend," ask **which** backend. Full detail + the diagram are in [CLAUDE.md](CLAUDE.md) and [ARCHITECTURE.md](ARCHITECTURE.md). This is the single most common source of confusion — read that section.

---

## 5. Where your code goes

```
frontend/src/     React app        → UI, screens, components
backend/src/      Express API      → business logic, data, AI orchestration
ai-services/      Python pipeline  → evaluation / level placement
```

- **UI change?** → `frontend/src/`
- **Rules/scoring/levels/data?** → `backend/src/` (NOT in React components)
- **Evaluation logic / prompts?** → `ai-services/`

---

## 6. Golden rules (do / don't)

**✅ Do**
- Keep changes small and focused — one thing per commit, one topic per PR.
- Put business logic (scoring, levels, locks, IDs, certification) on the **backend**.
- Match the style of the file you're editing.
- Run the app and actually click through your change before you push.
- Reference a shared value for magic numbers (`59`, `>=5`, `80/60`) instead of re-typing them.

**❌ Don't**
- **Don't add anything to `frontend/src/mock/`** — it's being deleted. New data goes through the real API.
- **Don't put business logic in React components** — it's an anti-pattern we're removing, not copying.
- **Don't ship answer keys or student PII (Aadhaar) in the frontend** — they must stay server-side.
- **Don't build on the current login/auth** — it's fake (any email = that role, no password). Being hardened later.
- **Don't touch `frontend/vite.config.ts` HMR/watch settings** — they're intentional.
- **Don't split the big files** (`RoleDashboards.tsx`, `PanelViews.tsx`) as a side effect — that's a dedicated later phase.

---

## 7. How to ship a change

1. **Branch** off `main`:
   ```bash
   git checkout -b feat/<short-name>      # or fix/<short-name>
   ```
2. **Make the change.** Keep commits small; write clear messages (*what* and *why*).
3. **Verify it works** — run the app (§3) and exercise the exact flow. Also:
   ```bash
   npm run lint        # type-check (note: this only checks types, not behavior)
   ```
   > `lint` passing does **not** mean it works. There are no automated tests — you must click through it. Two type errors are pre-existing (`backend/src/index.ts`, `paperGenerator.ts`); don't add new ones.
4. **Push and open a PR** against `main`. Describe what changed and how you tested it. One review before merge.

---

## 8. Common gotchas (you WILL hit these)

| Symptom | Fix |
|---|---|
| `EADDRINUSE :3000` | An old backend is still running. `netstat -ano \| grep :3000` → `taskkill //PID <pid> //F` |
| `Network error` on a feature | The mock doesn't implement it — start `dev:backend` too |
| `ModuleNotFoundError: requests` | Run `python -m pip install -r ai-services/requirements.txt` |
| `backend/data/db.json` shows as changed | The backend writes to it at runtime. Discard with `git checkout -- backend/data/db.json` before committing |
| VS Code shows a file as garbage / UTF-16 | Reopen it as UTF-8 (status bar → Reopen with Encoding). Keep files UTF-8 |
| "10K changes" in Source Control | That's `node_modules` (ignored). Reload the window |

---

## 9. Evaluation needs a key (optional but recommended)

The AI evaluation runs **without** a key using a crude deterministic fallback. For real, nuanced placement, add to `backend/.env`:

```
GROQ_API_KEY=...      # or
GEMINI_API_KEY=...
```

Never commit real keys.

---

## 10. Stuck?

- Architecture confusion → [CLAUDE.md](CLAUDE.md) §"Critical thing"
- "Where does this go?" → §5 above, or [MIGRATION_PLAN.md](MIGRATION_PLAN.md)
- "Is this a known issue?" → [AUDIT.md](AUDIT.md)
- Otherwise → ask the team before guessing on anything involving auth, the database, or deleting the mock.
