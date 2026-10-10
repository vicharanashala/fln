# Issue #687: local acceptance test guide

## 1. What was missing, and what changed?

Issue #592 / PR #652 supplied the blank question CSV and reference tables in one
ZIP. That work was correct, but the download always covered the entire curriculum.
A Balvatika author still had to search through all stages, recognize that the raw
name `Pre-school 3` meant Balvatika, and discover valid parameter values by trial
and error. There was no filled example to follow.

Issue #687 adds:

| Previous behavior | New behavior | Manual test |
|---|---|---|
| References always contain all stages | Choose one stage or keep All stages | M1–M3 |
| Only raw stage names appear in reference rows | Additional `stageName` gives the readable label | M2 |
| Parameter choices and dependencies are not included | `reference-allowed-values.csv` documents the backend catalog | M4 |
| No filled example | `questions-example.csv` contains one format-valid row | M5–M6 |
| No invalid-stage handling needed | Unknown stage returns 400 with valid choices | M8 |
| Stage labels absent from the backend snapshot | Labels are generated from the canonical source; drift check runs in PR checks | A2–A3 |

The importer, header-only `questions.csv`, existing flat CSV endpoint, curriculum
assignments and SVG selection logic are unchanged. SVG references are NOT filtered
by stage. This work does not implement worksheet generation or pedagogical approval.

## 2. Test status and evidence

Verification on 2026-10-07:

- Fresh run: **11/11 focused tests passed**, including the real browser download.
- Fresh run: generated curriculum snapshot drift check passed.
- Previous full run on this implementation: `npm run check:pr` passed all sections:
  backend/frontend type-checks, tests, builds, snapshot drift and route smoke checks.
- Browser test uses the real React panel, Express route handlers and JWT guard,
  with isolated in-memory database fixtures. It is not a manual end-to-end sign-off
  against your own seeded development database.
- The contributor subsequently reported that the manual test cases were successful
  and authorized publishing. Individual screenshots/results are not attached here;
  the checklist below remains a reusable blank record, not fabricated test evidence.

## 3. Start the correct local version

These commands are for Windows PowerShell. Use the separate issue worktree, NOT
the original `fln` folder or the old #592 worktree.

### Step 1: Open the worktree

In VS Code, use File → Open Folder and choose:

```text
C:\Users\vidya\OneDrive\Desktop\fln-issue-687
```

Open a terminal and run:

```powershell
Set-Location 'C:\Users\vidya\OneDrive\Desktop\fln-issue-687'
git branch --show-current
git status --short
```

Expected: branch `feat/687-stage-template-download`. Modified implementation files
are expected because this work has not been committed or pushed. Do not reset them.
On another computer, substitute the path of your checkout of this branch.

### Step 2: Dependencies and a safe test database

This local worktree already reuses installed dependencies. If dependencies are
missing in a separate checkout, run `npm.cmd install` from that checkout's root.

Use only your own development database. Do not point this test at production or a
shared team database. Do not copy an existing `.env` without checking its database
target first.

For a fresh, solo local test, the real backend supports a local JSON store when
`MONGODB_URI` is unset/empty. It creates and seeds `backend/data/db.json` on first
startup. This is a real backend storage mode, NOT a frontend mock.

If you need to create `backend/.env`, copy `backend/.env.example` only when the
destination does not exist, then edit it locally:

```powershell
if (-not (Test-Path backend/.env)) {
  Copy-Item backend/.env.example backend/.env
}
```

For local file-store testing:

1. Leave `MONGODB_URI` empty, including in inherited terminal environment settings.
2. Set `SEED_DEMO_PASSWORD` privately before the first seed to a password you choose.
3. Set `JWT_SECRET` privately to a long random secret.
4. Never commit these values or include them in screenshots.

The seeded superadmin email is `superadmin@fln.org`. Use your configured seed
password, or ask the team for credentials for an already-seeded local database.
Changing the seed password later does not reset hashes in an existing database.
Do not delete/reseed an existing database just to make login work.

This test does not need Gemini or Aadhaar tokenization. Do not test registration
or upload real student information as part of this issue.

### Step 3: Start the primary backend — Terminal A

Use dedicated ports to avoid accidentally connecting to an old running checkout:

```powershell
Set-Location 'C:\Users\vidya\OneDrive\Desktop\fln-issue-687'
$env:PORT = '3100'
npm.cmd run dev --workspace @fln/backend
```

Expected: the server reports it is running at `http://localhost:3100`. For the
file-store option it should report that it is using file-based storage. Leave this
terminal running. If the port is occupied, stop only your known old test process;
do not continue against an unidentified server.

This directly starts the primary API. The root `dev:backend` wrapper can reuse an
old API on port 3000 and starts another service, neither of which is needed here.

### Step 4: Start the frontend — Terminal B

```powershell
Set-Location 'C:\Users\vidya\OneDrive\Desktop\fln-issue-687'
$env:VITE_API_TARGET = 'http://127.0.0.1:3100'
$env:VITE_BASE_PATH = '/'
npm.cmd run dev --workspace @fln/frontend -- --port 5174 --strictPort
```

Expected: Vite starts at `http://localhost:5174`. Open that address. Requests to
`/api` go to this worktree's real backend on port 3100. No mock interceptor is used.

### Step 5: Find the feature

1. Log in as the local superadmin.
2. Open **Question Intervention** in the superadmin dashboard.
3. Click **Bulk upload CSV**.
4. Find the **Template stage** selector and **Download template + references (ZIP)**.

Expected: All stages is selected by default. Options include Preschool 1,
Preschool 2, Balvatika, and Classes 1–4.

If the selector is missing, check the folder, branch, URL and backend port first.
This is commonly a sign that the browser is showing the old checkout.

## 4. Manual acceptance cases

Keep each downloaded ZIP in its own extraction folder. Browser-added `(1)` suffixes
are normal on repeat downloads. Do not mix files from different downloads.

### M1 — Default/all-stage download

1. Leave **All stages** selected and click Download.
2. Extract `question-authoring-template.zip` into an `all-stages` test folder.
3. Open the files in a spreadsheet editor or text editor.

Expected: exactly these six files:

```text
questions.csv
questions-example.csv
reference-levels-and-subskills.csv
reference-svg-themes.csv
reference-allowed-values.csv
README.txt
```

Expected: `questions.csv` contains only headings; `questions-example.csv` contains
headings plus ONE example row; README says the download covers all stages.
The level references contain 109 DISTINCT levels in the current snapshot.

Important: there is one reference row per level/skill/subskill relationship.
109 levels does NOT mean 109 CSV rows.

Optional precise check: navigate in PowerShell to the extracted `all-stages` folder:

```powershell
$rows = Import-Csv ./reference-levels-and-subskills.csv -Encoding UTF8
($rows.levelNumber | Sort-Object -Unique).Count
$rows.stageName | Sort-Object -Unique
```

Expected: `109`, and seven stage names including Balvatika.

### M2 — Balvatika-only download (the main acceptance case)

1. Select **Balvatika**.
2. Verify the UI says **Balvatika: levels 19–46 (28 levels)**.
3. Download and extract `question-authoring-template-balvatika.zip` separately.
4. Open `reference-levels-and-subskills.csv`.

Expected:

- Only level numbers 19 through 46 appear: 28 distinct levels.
- Every `stage` cell is `Pre-school 3`.
- Every `stageName` cell is `Balvatika`.
- Skill/subskill codes and names are present for those levels.
- No level 18, 47 or 100 appears.
- README says the download covers Balvatika.
- The blank `questions.csv` is still header-only.

In PowerShell, from the extracted Balvatika folder:

```powershell
$rows = Import-Csv ./reference-levels-and-subskills.csv -Encoding UTF8
$levels = $rows | ForEach-Object { [int]$_.levelNumber } | Sort-Object -Unique
$levels.Count
$levels | Measure-Object -Minimum -Maximum
$rows.stageName | Sort-Object -Unique
$rows | Where-Object { [int]$_.levelNumber -lt 19 -or [int]$_.levelNumber -gt 46 }
```

Expected: count 28, minimum 19, maximum 46, only Balvatika, and no output from the
last command. Do not require exactly 28 reference rows: levels repeat by mapping.

### M3 — Other stages and returning to All stages

1. Select **Class 1**, download and inspect the reference file.
2. Select **All stages**, download again and inspect the new file.
3. Compare SVG reference contents from the Balvatika and all-stage downloads.

Expected: Class 1 shows levels 47–60 (14 distinct levels), filename ending
`-class-1.zip`. Returning to All stages restores all 109 levels and the unsuffixed
filename. SVG references remain identical across stage choices: only curriculum
references and the example are stage-specific.

Current snapshot for the complete stage sweep:

| Selection | First–last level | Distinct levels |
|---|---|---|
| Preschool 1 | 1–8 | 8 |
| Preschool 2 | 9–18 | 10 |
| Balvatika | 19–46 | 28 |
| Class 1 | 47–60 | 14 |
| Class 2 | 61–77 | 17 |
| Class 3 | 78–91 | 14 |
| Class 4 | 92–109 | 18 |
| All stages | 1–109 | 109 |

These are snapshot expectations, not hardcoded application filtering boundaries.

### M4 — Allowed values and rules

Open `reference-allowed-values.csv`.

Expected: columns `column`, `allowedValues`, `rule`. Check:

- `questionFamily` lists all ten families, including counting, shape and reasoning.
- `answerType` includes single-number, mcq-4 and fill-blanks.
- `operations` lists add, subtract, multiply and divide.
- `generationIntent` requires 20–2000 characters.
- `blankCount` is 1–6 and only applies to fill-blanks.
- `questionCount` is 1–50, default 10.
- `carryBehavior` requires add; `borrowBehavior` requires subtract.
- Deprecated numeral ranges are identified (`0-100`, `0-1000` in this snapshot).

Array choices are separated by `|`. Structured limits/metadata may be JSON in the
allowedValues cell; the adjacent rule explains their meaning. Metadata rows such
as contextRules are explicitly marked as NOT columns to add to questions.csv.

### M5 — Example validation without saving anything

1. Open the Balvatika `questions-example.csv` in a text editor.
2. Inspect the two lines: headings plus one data row. The concept/skill/subskill
   comes from the first level of the chosen stage.
3. Copy the complete example into a separate test copy named `questions.csv`.
   Preserve all columns and UTF-8 encoding. Do not copy the reference table.
4. On the page, choose that `questions.csv` with the file picker (or paste its
   complete contents into the CSV text area).
5. Click **Check the file**, NOT Import.

Expected: **1 row(s) are ready to import.** A warning about an existing variation
is not a validation failure. In the browser Network panel, the import request has
`dryRun: true`, with response `wouldImport: 1`, `imported: 0`, and no row errors.
No new question template is stored.

The example illustrates valid CSV syntax and parameters. It is not a claim that
generic counting content teaches every stage's first concept. Adapt actual authored
content to the intended concept before doing a real import.

### M6 — Validate examples for every stage

Repeat M5 for every option in the M3 table, including All stages. Download afresh,
copy that example into a test questions.csv, and Check the file each time.

Expected: one row ready, zero errors and zero imported for all eight selections.
Record a pass per selection. This checks that filtering does not produce broken
concept/skill/subskill combinations.

### M7 — Existing validation still rejects invalid content

Starting with the valid example, edit a test copy in a spreadsheet editor and save
as UTF-8 CSV. Change ONE field per run; restore the valid example between runs.

| Change | Expected after Check the file |
|---|---|
| generationIntent becomes `Count` | Error for intent shorter than 20 characters |
| questionCount becomes `51` | Error for count outside 1–50 |
| answerType becomes `not-an-answer-type` | Error for unsupported answer type |
| blankCount becomes `2`, answerType remains single-number | Error because blankCount requires fill-blanks |
| carryBehavior becomes allowed, operations stays empty | Error because carryBehavior requires add |

Expected: row-level validation errors and Import disabled. Do not require an exact
error sentence; it must identify the invalid field/rule. Restoring the valid file
must make Check the file pass again. Nothing should be saved in these dry runs.

### M8 — API stage aliases and invalid input (optional technical check)

While logged in at the LOCAL test app, open Developer Tools → Console. These snippets
only read/download data. Understand them before running; do not bypass browser paste
warnings. They use the existing local token but do not print it. Never share tokens,
Authorization headers or unredacted network exports.

Run this small helper once:

```javascript
async function checkStage(query) {
  const response = await fetch('/api/question-templates/csv-template.zip' + query, {
    headers: { Authorization: 'Bearer ' + localStorage.getItem('fln_token') }
  });
  console.log(response.status, response.headers.get('content-disposition'));
  if (!response.ok) console.log(await response.json());
}
```

Then run individually:

```javascript
await checkStage('?stage=Balvatika');
await checkStage('?stage=Pre-school%203');
await checkStage('?stage=PRE%20SCHOOL%203');
await checkStage('?stage=nonsense');
await checkStage('?stage=');
await checkStage('');
```

Expected: first three return 200 and the same Balvatika filename; nonsense returns
400 with `error: "Unknown stage."` and a validStages list; last two return 200 with
the unsuffixed all-stage filename. Opening an authenticated download URL directly
in the address bar is not equivalent: that navigation does not send the bearer token.

### M9 — Unauthenticated access and download failure

Without removing your login token, run this read-only local request in the console:

```javascript
const denied = await fetch('/api/question-templates/csv-template.zip?stage=Balvatika');
console.log(denied.status);
```

Expected: 403 because there is no Authorization header. Teacher-role requests are
also covered by the automated test; the feature remains superadmin-only.

To check a network failure manually: keep the page open, stop only Terminal A with
Ctrl+C, then click Download. Expected: a visible download error, no ZIP saved as a
successful response, and no page crash. Restart Terminal A before continuing.

### M10 — Optional real import (writes data; disposable local database ONLY)

This is not necessary to prove the new download feature. Do it only if you also
want to exercise the existing persistence flow in your own disposable database.

1. Use one valid test questions.csv. Put a recognizable unique label such as
   `Manual test 687 - disposable` in its `name` column.
2. Check the file, then click Import ONCE.
3. Clear list filters and locate that named template.
4. Remove only that template through the UI's delete action when finished.

Expected: success message says one question imported and the row appears. Removal
uses the existing UI deletion behavior. Do not reset the whole database. Never run
this case against shared/production data or import the same file repeatedly.

## 5. Reproducible automated checks

From the issue worktree root in a separate terminal:

### A1 — Focused tests, including browser

```powershell
$env:RUN_BROWSER_TESTS = '1'
$env:CHROME_EXECUTABLE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
npm.cmd run test:question-template-download --workspace @fln/backend
```

Expected: tests 11, pass 11, fail 0, skipped 0. Adjust the browser path if Edge is
installed elsewhere. Without RUN_BROWSER_TESTS=1, the browser test is skipped; do
not mistake that for having tested the download in a browser. Tests use isolated
fixtures and do not need your running development API or database.

### A2 — Snapshot consistency

```powershell
node --import tsx scripts/generate-skill-level-map.ts --check
```

Expected: snapshot matches source. If it fails, investigate the mismatch instead
of regenerating blindly and hiding an unintended source change.

### A3 — Full PR check suite

Stop your manual test servers first. From the worktree root:

```powershell
$env:PATH = 'C:\Program Files\Git\bin;C:\Program Files\Git\usr\bin;' + $env:PATH
npm.cmd run check:pr
```

Expected: every summary section PASS and `All checks passed.` An existing large
frontend bundle warning is not a build failure. Git for Windows provides the bash
executable this script needs; adjust its path if installed elsewhere.

This suite starts a temporary server on port 3999 and temporarily uses the local
file store. Run it only in the isolated development worktree. On Windows a child
server may remain after the shell exits; identify its worktree/process before
stopping it. Never kill all Node processes indiscriminately.

## 6. Troubleshooting

| Symptom | Check |
|---|---|
| No stage selector | Correct worktree/branch, frontend 5174, hard-refresh |
| Download contains only four files | Frontend may be talking to old API; verify VITE_API_TARGET=3100 |
| Login fails | Correct local DB and existing seeded password; do not reset data blindly |
| Download returns 403 | Superadmin session and bearer token; a plain address-bar link is insufficient |
| Browser test skipped | Enable RUN_BROWSER_TESTS=1 |
| Only one CSV column in Excel | Use Data → From Text/CSV with UTF-8 and comma delimiter |
| More than 28 Balvatika rows | Expected: count distinct levelNumber values, not mapping rows |
| Example fails Check the file | Confirm the complete header/row, UTF-8 CSV, correct stage download and new API |
| Port already in use | Stop only the known test server; do not silently reuse an older checkout |

## 7. Manual sign-off record

Fill this after testing; leave unexecuted cases unchecked.

- Tester / date:
- Branch / base commit (`git rev-parse HEAD`):
- Browser / version:
- Local storage mode (file store or personal MongoDB; do NOT record credentials):
- [ ] M1 all-stage download
- [ ] M2 Balvatika-only references
- [ ] M3 stage switching and unchanged SVG reference
- [ ] M4 allowed values/rules
- [ ] M5 valid example dry run, no write
- [ ] M6 all eight selection examples
- [ ] M7 invalid input rejected
- [ ] M8 API aliases and invalid stage (or automated evidence noted)
- [ ] M9 access control and download error
- [ ] M10 optional real import/cleanup, or mark Not run
- [ ] A1, A2, A3 passed
- Screenshot filenames / observations / failures:
- Decision: Ready for push / Needs correction

Save screenshots of the stage selector, distinct-level checks, ZIP contents and
validation messages. Redact private data. Stop both manual servers with Ctrl+C.
Do not push until failures are resolved and the intended checks are signed off.
