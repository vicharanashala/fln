# PR review rules

How we decide whether a pull request can be merged. The goal is simple: **nothing broken lands on `main`** — not in the files the author touched, and not in the files that depend on them.

## 1. Judge the PR against the issue it links

- Every PR links the issue it closes with `Closes #N` on its own line. Issues listed under "Relates to" set no requirements.
- Review against that issue's acceptance criteria, line by line: met, partly met, or missing. Do not review against what the reviewer would have built instead.
- If the PR does not meet the issue, there are two honest outcomes:
  - **The PR is incomplete.** Comment with what is left against each criterion, and wait for the author.
  - **The issue is larger than a first version.** Rescope the issue to a v1 that matches the PR, keep the original text unchanged at the bottom of the issue, and file follow-up issues for the rest. Link them. Say plainly in the comment that the issue was rescoped.
- A claim in the PR description is a claim to verify. Check "triggered by X", "fixes N cases" and "all tests pass" against the code.

## 2. The automated gate (`PR checks`)

`.github/workflows/pr-checks.yml` runs on every pull request, against the **merge of the PR into `main`**, so it tests what would actually land. It runs `scripts/ci/pr-checks.sh` (also `npm run check:pr` locally):

| Check | What it catches |
|---|---|
| Conflict markers | `<<<<<<<`, `=======`, `>>>>>>>` left in a changed file |
| Type check, backend and frontend | Syntax errors, and any file that imports something the PR changed or removed |
| Tests | Every `test:*` script in `backend/package.json` (new ones are picked up automatically), `npm test` in the backend, and the frontend tests |
| Builds | Frontend `vite build` and the backend bundle |
| Route smoke test | Boots the server with no database and calls every parameterless `GET /api` route as a superadmin and as a teacher. Fails on a 5xx or a hang. This is what catches runtime breakage that compiles fine, such as a database call with no fallback. |

Rules:
- **Do not merge on a red check.** If a check is wrong, fix the check in its own PR.
- `scripts/ci/smoke-baseline.txt` lists routes that already failed when the check was introduced, with the reason. The check fails only on a *new* failure. When you fix a route, delete its line (the script tells you when an entry now passes).
- A new test script, check script or route is covered automatically. You do not edit the workflow to add one.

## 3. What a reviewer tests by hand

The gate answers "does it run". A reviewer still asks "is it right", from every angle that applies:

**Who is calling**
- Not logged in, teacher, school, volunteer, geo-admin, superadmin.
- A user from another school or district. Every new route needs an authorization check, and a request for a record that does not exist must be rejected, not skipped.

**What data it meets**
- A fresh seed, and existing data in an older shape (missing keys, old IDs).
- Empty, huge, malformed and duplicate input. A record that does not exist. A retried request (is it idempotent?).

**What it runs on**
- With MongoDB and without it (the local file store).
- With and without optional services: a Gemini key, Ollama/Gemma.
- Development and production settings (CORS, debug logging, default credentials).

**Compatibility**
- Old clients that do not send a new parameter must behave as before.
- Existing response shapes, collection names and stored data are unchanged, or migrated.
- A `GET` that writes to the database is a red flag.

**The user interface**
- Open it in the browser, walk the golden path, check the console for errors.

## 4. Blast radius: "did this fix break something else?"

For every changed export, type, route, collection, environment variable or shared helper:
- Search for every importer and caller. The type check covers imports; **also** search for string uses (route paths, collection names, JSON keys), which it cannot see.
- Check shared files (`db.ts`, `auth.ts`, `App.tsx`, `index.ts`) for route shadowing, registration order and renamed fields.
- Check `package.json` and `package-lock.json` move together, and seeds, docs and the changelog still match.
- Check the level numbering. The curriculum is 109 levels; the older 59- and 93-level numbers are aliases, not current ids.

## 5. If you cannot test it here, make GitHub test it

Some things need a service the reviewer does not have (Gemma, a paid key, production data). Do not skip them silently:
- Write a check script that calls the real logic with stub data, under `backend/src/__checks__/` or as a `test:*` script, and the gate will run it on every PR.
- A behaviour a reviewer verified by hand should be turned into such a script, so it is re-verified for every later PR.
- A check script must import application code. A script that asserts values it built itself passes even if the feature is deleted.

## 6. Merge checklist

- [ ] `PR checks` is green and there are no conflicts.
- [ ] `Closes #N` is present and the acceptance criteria are met (or the issue was rescoped and linked).
- [ ] The description matches the code.
- [ ] Authorization was checked for every new route, including records that do not exist.
- [ ] Anything deferred has its own issue.
- [ ] New behaviour has a check script that calls the real code.

## 7. Comments

Be polite and specific. List what is left against each issue, give file and line, and sign off as **Team Vicharanashala**. Do not post or merge on someone's behalf without the maintainer's go-ahead.
