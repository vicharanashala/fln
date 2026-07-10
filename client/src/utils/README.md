# Adaptive AI-Based Personalized Question Paper Generation

## Overview

Generates personalized FLN (Foundational Literacy and Numeracy) assessment worksheets by leveraging an OpenAI-compatible API. Each worksheet is dynamically constructed per student, targeting their current competency level and known weak areas from prior evaluations. The feature is designed to be fully functional with or without an active AI provider — a built-in fallback question bank ensures all UI flows work during development, testing, and demonstration.

## Problem Statement

In large classroom environments, producing individualised assessment material for each student is impractical manually. Students at different FLN levels require questions calibrated to their current proficiency. Standardised one-size-fits-all question papers fail to capture where each child actually stands, making it difficult for teachers to identify gaps and provide targeted remediation. This feature automates per-student worksheet generation, freeing educators to focus on instruction rather than paper preparation.

## Workflow

```
Teacher Login
       ↓
Teacher Dashboard
       ↓
Generate Question Paper
       ↓
Select Grade, Subject, Student, FLN Level, Number of Questions
       ↓
AI Generates Personalized Questions
       ↓
Preview
       ↓
Print / Download PDF
       ↓
Worksheet History
       ↓
Regenerate Worksheet
```

## Features

- **Teacher Question Paper Generator** — form-based UI to select class, subject, and assessment cycle; triggers batch generation for all students in a class.
- **AI-Based Personalized Question Generation** — questions are tailored to each student's FLN level and known weak areas from prior evaluations.
- **AI Fallback Mechanism** — when the AI API key is not configured or the request fails, the system falls back to a built-in question bank; the application remains fully functional.
- **Printable Question Papers** — A4-optimised layout with `@page` margins, `page-break-inside` on questions, and a bordered info grid (school, student, grade, level, date).
- **PDF Export** — client-side PDF generation via `html2pdf.js`, loaded on demand (dynamic import keeps the main bundle under 100 kB).
- **Worksheet History** — full-width data table with per-row actions (View, Print, PDF, Regenerate, Delete).
- **Worksheet Regeneration** — creates a new worksheet reusing the original student context (grade, subject, level, weaknesses); the original worksheet is preserved.
- **Soft Delete** — worksheets are flagged as `isActive: false` rather than removed from the database.
- **Search, Filters and Sorting** — search by student name or ID; filter by grade, FLN level, assessment cycle, and date range; sort by latest or oldest.
- **Responsive UI** — sidebar collapses on mobile, tables scroll horizontally, filter cards stack vertically on small screens.
- **Validation** — required-field checks before form submission; user-friendly error messages for network, timeout, and server errors.
- **Error Handling** — comprehensive mapping of API failures (auth, rate-limit, timeout, malformed responses, network errors) to actionable messages.
- **Accessibility Improvements** — `aria-*` attributes on interactive elements, `htmlFor` labels on form fields, `:focus-visible` outlines for keyboard navigation.

## System Architecture

```
React (SPA)
    ↓  HTTP (axios)
Express API
    ↓
Controller (thin handlers)
    ↓
Service Layer (business logic)
    ↓
AI Service (OpenAI-compatible)
    ↓
OpenAI-Compatible API (GPT-4o-mini / any provider)
```

The frontend communicates with the Express backend through a REST API. Controllers delegate business logic to services. The AI service wraps the OpenAI-compatible chat completion endpoint, handling prompt construction, response parsing, and error recovery. When no API key is configured, the service throws a descriptive error and the controller falls back to mock questions.

## Backend Components

| Component | Role |
|-----------|------|
| **Controllers** | `worksheetController` — thin route handlers for generation, history, retrieval, regeneration, and deletion delegates to service layer. |
| **Services** | `aiService.generateQuestions` — builds system and user prompts, calls OpenAI-compatible chat completions, parses structured JSON (handles markdown fences, wrapped `{questions}` shape, raw array). `worksheetService.regenerateForWorksheet` — reads original worksheet parameters, fetches latest evaluation weaknesses, calls AI service (with fallback), creates a new `Worksheet` document. |
| **AI Config** | `config/ai.js` — reads `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `AI_MAX_TOKENS`, `AI_TIMEOUT` from environment; lazy client initialisation to prevent crashes when credentials are absent. |
| **Routes** | `routes/worksheets.js` — auth-protected route definitions for all worksheet endpoints. |
| **Models** | `Worksheet` — schema for student, class, school, FLN level, assessment cycle, questions JSON, generation metadata, soft-delete flag. `GenerationLock` — prevents overlapping generation for the same class and cycle. |

## Frontend Components

| Component | Role |
|-----------|------|
| `GenerateQuestionPaper` | Form to select class and cycle; triggers batch generation; shows recent worksheets with Print/PDF buttons. |
| `WorksheetHistory` | Full-width data table with search bar, grade/level/cycle/date filters, sort toggle; per-row actions: View (modal), Print, PDF, Regenerate, Delete. |
| `Toast` | Fixed-position notification that auto-dismisses after 4 seconds; supports `success`, `error`, `info` variants. |
| `Spinner` | CSS-only spinning indicator with optional text label; three sizes (sm, md, lg). |
| `worksheetHtml` | Builds a complete A4 HTML document from worksheet data for printing or PDF conversion. |
| `worksheetActions` | `handlePrint` — opens a popup and calls `window.print()`. `handleDownloadPDF` — dynamically imports `html2pdf.js`, renders the worksheet off-screen, and triggers a download. |
| `validation` | `validateGeneration` — checks required fields before submission. `getErrorMessage` — maps network/timeout/server errors to user-friendly messages. |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/worksheets/generate-class` | Generate worksheets for all students in a class |
| `GET` | `/api/worksheets/history` | List worksheets with search, filters, sorting |
| `GET` | `/api/worksheets/:id` | Get single worksheet with full details |
| `GET` | `/api/worksheets/student/:studentId` | Get worksheets for a specific student |
| `POST` | `/api/worksheets/:id/regenerate` | Create a new worksheet reusing original parameters |
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

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_API_KEY` | *(empty)* | OpenAI-compatible API key. Falls back to mock questions when unset |
| `AI_BASE_URL` | `https://api.openai.com/v1` | API base URL for OpenAI-compatible providers |
| `AI_MODEL` | `gpt-4o-mini` | Model identifier used in chat completion requests |
| `AI_MAX_TOKENS` | `2000` | Maximum tokens per generation response |
| `AI_TIMEOUT` | `30000` | Request timeout in milliseconds |

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

Create `server/.env`:

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

## Testing

The feature was verified through the following methods:

- **Module loading** — all server modules (`config/ai.js`, `services/aiService.js`, `services/worksheetService.js`, `controllers/worksheetController.js`, `routes/worksheets.js`, `models/Worksheet.js`) load without runtime errors.
- **API response validation** — each endpoint was tested with `curl` for correct HTTP status codes: `401` without authentication, `204` for OPTIONS preflight, and expected response shapes for authorised requests.
- **Frontend build** — `react-scripts build` compiles without errors or warnings.
- **Cherry-pick integrity** — all 6 feature commits were applied onto a fresh `upstream/main` root with no code conflicts; the single `.gitignore` conflict was resolved by combining both files' rules.
- **Error path coverage** — AI timeout, invalid API key, malformed response, network failure, and missing resource scenarios each produce appropriate fallback behaviour or user-facing error messages.

## Future Improvements

- **Batch PDF download** — generate a single archive (ZIP) for all worksheets in a class.
- **Customisable question count** — allow the teacher to set the number of questions per worksheet.
- **Additional subjects** — extend AI prompts to support Language, EVS, and other curricula.
- **Cached responses** — avoid redundant API calls when parameters are identical.
- **Streaming progress** — use Server-Sent Events or WebSockets to update generation progress in real time.
- **History pagination** — replace the current 200-record limit with cursor-based pagination.
- **Worksheet comparison** — side-by-side diff of original and regenerated worksheets.
