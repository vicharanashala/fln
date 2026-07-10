# Adaptive AI-Based Personalized Question Paper Generation

## Feature Overview

Generates personalized FLN (Foundational Literacy and Numeracy) assessment worksheets by leveraging an OpenAI-compatible API. Each worksheet is dynamically constructed per student, targeting their current competency level and known weak areas from prior evaluations.

## Problem Statement

In large classroom environments, producing individualised assessment material for each student is impractical manually. Students at different FLN levels require questions calibrated to their current proficiency. This feature automates per-student worksheet generation, freeing educators to focus on instruction and remediation.

## Key Features

- **AI-driven personalisation** — questions target the student's FLN level and specific weak competencies.
- **Graceful fallback** — when the AI API key is not configured, the system falls back to a built-in question bank; the application remains fully functional.
- **Lazy AI client** — the OpenAI client is initialised only on first use, preventing crashes when credentials are absent.
- **Per-worksheet PDF download** — client-side PDF generation via `html2pdf.js`, loaded on demand.
- **Print-optimised layout** — A4 formatted with `@page` margins, `page-break-inside` on questions, and a bordered info grid (school, student, grade, level, date).
- **Full history management** — search, filter by grade/level/cycle/date range, sort, view, regenerate, and soft-delete worksheets.
- **Generation lock** — prevents concurrent generation for the same class and assessment cycle by different users.
- **Audit logging** — every generation batch is recorded in the logbook.

## Workflow

1. Teacher selects a class and assessment cycle on the Generate Question Paper page.
2. System fetches each student's current FLN level and latest evaluation weaknesses.
3. AI generates personalised questions targeting the student's level and weak competencies.
4. Teacher prints or downloads PDFs of individual worksheets.
5. Worksheet History lets teachers view, regenerate, or delete previously generated worksheets.

## Architecture

```
client/                         React SPA (Create React App)
  src/
    pages/dashboards/
      GenerateQuestionPaper.js  Primary generation UI
      WorksheetHistory.js       Worksheet list with search, filters, actions
    components/
      Layout.js                 Role-based sidebar navigation
      Toast.js                  Auto-dismiss notification component
      Spinner.js                CSS loading spinner
    utils/
      worksheetHtml.js          A4-formatted HTML builder for print/PDF
      worksheetActions.js       Shared print and PDF-download helpers
      validation.js             Field validators and error message mapper
    services/
      api.js                    Axios HTTP client with auth interceptor

server/                         Express + Mongoose (MongoDB)
  controllers/
    worksheetController.js      Route handlers (thin, delegates to services)
  services/
    aiService.js                OpenAI-compatible chat completion wrapper
    worksheetService.js         Regeneration business logic
  models/
    Worksheet.js                Schema: student, class, school, level,
                                assessmentCycle, worksheetJson, generatedBy
    Student.js                  Tracks currentLevel, identity, class/school refs
    Class.js                    Grade, section, school, teacher assignment
    School.js                   Name, location, student strength flag
    EvaluationReport.js         Stores per-student weaknesses from latest eval
    GenerationLock.js           Prevents overlapping generation per class+cycle
  config/
    ai.js                       Reads AI_API_KEY, AI_BASE_URL, AI_MODEL, etc.
  routes/
    worksheets.js               Route definitions (auth-protected)
```

### Frontend Components

| Component | Role |
|-----------|------|
| `GenerateQuestionPaper` | Form to select class and cycle; triggers batch generation; shows recent worksheets with Print/PDF buttons. |
| `WorksheetHistory` | Full-width data table with search bar, grade/level/cycle/date filters, sort toggle; per-row actions: View (modal), Print, PDF, Regenerate, Delete. |
| `Layout` | Renders sidebar from role-based nav items; wraps all page content. |
| `Toast` | Fixed-position notification that auto-dismisses after 4 seconds; supports `success`, `error`, `info` variants. |
| `Spinner` | CSS-only spinning indicator with optional text label; three sizes. |
| `worksheetHtml` | Builds a complete A4 HTML document from worksheet data for printing or PDF conversion. |
| `worksheetActions` | `handlePrint` — opens a popup and calls `window.print()`. `handleDownloadPDF` — dynamically imports `html2pdf.js`, renders the worksheet off-screen, and triggers a download. |
| `validation` | `validateGeneration` — checks required fields before submission. `getErrorMessage` — maps network/timeout/server errors to user-friendly messages. |

### Backend Components

| Component | Role |
|-----------|------|
| `worksheetController.getHistory` | Accepts query params (`search`, `grade`, `level`, `assessmentCycle`, `startDate`, `endDate`, `sort`). Joins against `Student` for name/ID search and `Class` for grade filter. Returns `{ worksheets, total }`. |
| `worksheetController.regenerateWorksheet` | Validates ID, delegates to `worksheetService.regenerateForWorksheet`, returns the newly created worksheet with populated references. |
| `worksheetController.deleteWorksheet` | Sets `isActive: false` (soft delete). |
| `aiService.generateQuestions` | Builds system prompt (FLN competency levels Level1–Level8) and user prompt with student context, calls OpenAI-compatible chat completions, parses the JSON response (handles markdown fences, wrapped `{questions}` shape, raw array). |
| `worksheetService.regenerateForWorksheet` | Reads original worksheet parameters (grade, subject, student, level), fetches latest evaluation weaknesses, calls AI service (with fallback), creates a new `Worksheet` document with a unique ID. |
| `ai` config | Reads `AI_API_KEY` (or `OPENAI_API_KEY`), `AI_BASE_URL` (or `OPENAI_BASE_URL`), `AI_MODEL`, `AI_MAX_TOKENS`, `AI_TIMEOUT` from environment. |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST`   | `/api/worksheets/generate-class` | Generate worksheets for all students in a class |
| `GET`    | `/api/worksheets/history` | List worksheets with search, filters, sorting |
| `GET`    | `/api/worksheets/:id` | Get single worksheet with full details |
| `GET`    | `/api/worksheets/student/:studentId` | Get worksheets for a specific student |
| `POST`   | `/api/worksheets/:id/regenerate` | Create a new worksheet reusing original parameters |
| `DELETE` | `/api/worksheets/:id` | Soft-delete a worksheet |

### Query Parameters for `GET /api/worksheets/history`

| Param | Type | Description |
|-------|------|-------------|
| `search` | `string` | Match against student name or student ID (case-insensitive) |
| `grade` | `number` | Filter by class grade (1–5) |
| `level` | `string` | Filter by FLN level, e.g. `Level3` |
| `assessmentCycle` | `string` | One of `practice`, `baseline`, `mid_year`, `end_year` |
| `startDate` | `string` | ISO date string; filters `createdAt >= startDate` |
| `endDate` | `string` | ISO date string; filters `createdAt <= endDate` (end of day) |
| `sort` | `string` | `latest` (default, descending) or `oldest` (ascending) |

### Response Shapes

```json
// GET /api/worksheets/history
{
  "worksheets": [
    {
      "_id": "...",
      "worksheetId": "WS-1689000000000-STU-ABC",
      "student": { "_id": "...", "name": "...", "studentId": "...", "currentLevel": "Level3" },
      "class": { "_id": "...", "name": "Class 3", "grade": 3, "section": "" },
      "school": { "_id": "...", "name": "Government Primary School" },
      "level": "Level3",
      "assessmentCycle": "practice",
      "worksheetJson": {
        "exam_id": "EXAM-...",
        "class": 3,
        "subject": "Mathematics",
        "total_questions": 10,
        "questions": [ /* ... */ ]
      },
      "generatedBy": { "_id": "...", "name": "Rajesh Kumar" },
      "status": "generated",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "total": 15
}

// POST /api/worksheets/:id/regenerate
{
  "worksheet": { /* same shape as above — a brand-new document */ }
}

// DELETE /api/worksheets/:id
{ "message": "Worksheet deleted successfully" }
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_API_KEY` | *(empty)* | OpenAI-compatible API key. Falls back to mock questions when unset |
| `OPENAI_API_KEY` | — | Read as fallback if `AI_API_KEY` is not set |
| `AI_BASE_URL` | `https://api.openai.com/v1` | API base URL for OpenAI-compatible providers |
| `OPENAI_BASE_URL` | — | Read as fallback if `AI_BASE_URL` is not set |
| `AI_MODEL` | `gpt-4o-mini` | Model identifier used in chat completion requests |
| `AI_MAX_TOKENS` | `2000` | Maximum tokens per generation response |
| `AI_TIMEOUT` | `30000` | Request timeout in milliseconds |
| `REACT_APP_API_URL` | `/api` | Client-side API base URL (proxied in development) |
| `MONGODB_URI` | `mongodb://localhost:27017/fln` | MongoDB connection string |
| `JWT_SECRET` | *(required)* | Secret key for signing authentication tokens |

## Installation

### Prerequisites

- Node.js 18+
- MongoDB 6+ (local or remote)
- npm

### Steps

```bash
# Clone the repository
git clone <repository-url>
cd fln

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install

# Seed the database with demo data
cd ../server && node seed.js
```

### Configuration

Create `server/.env` (a template is provided in the repository):

```env
MONGODB_URI=mongodb://localhost:27017/fln
JWT_SECRET=<generate-a-random-secret>
AI_API_KEY=
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_MAX_TOKENS=2000
AI_TIMEOUT=30000
```

## Usage

### Starting the Application

```bash
# Terminal 1 — Backend (port 5000)
cd server && node index.js

# Terminal 2 — Frontend (port 3000)
cd client && npm start
```

The development server proxies API requests to `localhost:5000`.

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Teacher | `gps-mt-001.t01@fln.org` | `Teacher@123` |

### Generating Worksheets

1. Log in as a teacher.
2. Navigate to **Generate Question Paper** from the sidebar.
3. Select a class and assessment cycle.
4. Click **Generate Question Paper**.
5. After generation completes, use **Print** or **PDF** buttons to export individual worksheets.

### Worksheet History

1. Navigate to **Worksheet History** from the sidebar.
2. Use the search bar to find worksheets by student name or ID.
3. Apply filters: Grade, FLN Level, Assessment Cycle, Date Range.
4. Sort by **Latest First** or **Oldest First**.
5. Per-row actions:
   - **View** — opens a modal displaying the full question paper.
   - **Print** — opens the A4-formatted worksheet in a new window.
   - **PDF** — downloads the worksheet as a PDF file.
   - **Regen** — generates a new worksheet using the same parameters (original is preserved).
   - **Delete** — soft-deletes the worksheet after confirmation.

### AI Integration

To enable real AI-generated questions, set the API key in `server/.env`:

```env
AI_API_KEY=sk-your-api-key-here
```

Without a key the system uses a built-in question bank matching each FLN level. The mock fallback covers all UI flows, so the feature can be demonstrated, tested, and developed without an AI provider.

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| **AI API key not configured** | `aiService.generateQuestions` throws a descriptive error; controller catches it and falls back to mock questions |
| **AI request timeout** | `AbortController` fires after `AI_TIMEOUT` ms; controller logs the failure and uses the fallback bank |
| **Invalid AI API key (401)** | OpenAI returns 401; `aiService` re-throws as `"Invalid AI API key"`; fallback kicks in |
| **Rate limit (429)** | Caught and re-thrown as a friendly message; fallback activated |
| **Empty or malformed AI response** | `parseQuestions` returns `null`; `aiService` throws `"AI returned invalid or empty question format"` |
| **Network failure** | Axios `ERR_NETWORK` is mapped to `"Unable to connect to the server"` on the client |
| **Server unavailable (502/503/504)** | Mapped to `"Server is currently unavailable. Please try again later."` |
| **Generation lock conflict (409)** | Controller returns the lock owner and timestamp; frontend displays a targeted warning |
| **Worksheet not found (404)** | Standard 404 response with `"Worksheet not found"` message |
| **Client-side PDF generation failure** | Any error during `html2pdf` rendering is caught by the `finally` block which cleans up the off-screen container; the user is notified via the toast system |

### Frontend Error Display

- Validation errors are shown as inline messages before form submission.
- API errors are displayed via the `Toast` component (auto-dismiss after 4 s) or a static `error-message` banner for critical failures.
- The regenerating button is disabled while the request is in-flight to prevent duplicate submissions.

## Future Improvements

- **Batch PDF download** — generate a single archive (ZIP) for all worksheets in a class.
- **Customisable question count** — allow the teacher to set the number of questions per worksheet.
- **Additional subjects** — extend AI prompts to support Language, EVS, and other curricula.
- **Cached responses** — avoid redundant API calls when parameters are identical.
- **Streaming progress** — use Server-Sent Events or WebSockets to update generation progress in real time.
- **History pagination** — replace the current 200-record limit with cursor-based pagination.
- **Worksheet comparison** — side-by-side diff of original and regenerated worksheets.
