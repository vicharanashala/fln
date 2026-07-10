# Adaptive AI-Based Personalized Question Paper Generation

## Feature Overview

This feature enables teachers to generate personalized FLN (Foundational Literacy and Numeracy) assessment question papers using AI. Each worksheet is tailored to a student's current FLN competency level and addresses their specific weak areas identified from previous evaluations.

## Workflow

1. **Teacher selects a class and assessment cycle** on the Generate Question Paper page.
2. **System fetches each student's current FLN level** and latest evaluation weaknesses.
3. **AI generates personalized questions** targeting the student's level and weak competencies.
4. **Teacher prints or downloads PDFs** of individual worksheets.
5. **Worksheet History** lets teachers view, regenerate, or delete previously generated worksheets.

## Architecture

```
client/                         React SPA
  src/
    pages/dashboards/
      GenerateQuestionPaper.js  Main generation page
      WorksheetHistory.js       History & management page
    components/
      Layout.js                 Sidebar navigation with role-based links
      Toast.js                  Toast notification component
      Spinner.js                Loading spinner component
    utils/
      worksheetHtml.js          Builds printable A4 worksheet HTML
      worksheetActions.js       Print & PDF download helpers
      validation.js             Field validation & error messages
    services/
      api.js                    Axios API client

server/                         Express + MongoDB
  controllers/
    worksheetController.js      Route handlers (thin)
  services/
    aiService.js                AI question generation via OpenAI-compatible API
    worksheetService.js         Regeneration business logic
  models/
    Worksheet.js                Worksheet schema
    Student.js                  Student with FLN level tracking
    Class.js
    School.js
    EvaluationReport.js         Stores evaluation weaknesses per student
    GenerationLock.js           Prevents concurrent generation
  config/
    ai.js                       AI config from environment variables
  routes/
    worksheets.js               API route definitions
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | `/api/worksheets/generate-class` | Generate worksheets for all students in a class |
| GET    | `/api/worksheets/history` | List worksheets with search, filters, sorting |
| GET    | `/api/worksheets/:id` | Get single worksheet with full details |
| GET    | `/api/worksheets/student/:studentId` | Get worksheets for a specific student |
| POST   | `/api/worksheets/:id/regenerate` | Create a new worksheet reusing original parameters |
| DELETE | `/api/worksheets/:id` | Soft-delete a worksheet |

### Query Parameters for `/api/worksheets/history`

| Param | Type | Description |
|-------|------|-------------|
| search | string | Search by student name or student ID |
| grade | number | Filter by class grade (1-5) |
| level | string | Filter by FLN level (e.g., "Level3") |
| assessmentCycle | string | Filter by cycle (practice, baseline, mid_year, end_year) |
| startDate | string | Filter by created date (ISO) |
| endDate | string | Filter by created date (ISO) |
| sort | string | "latest" (default) or "oldest" |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_API_KEY` | `(empty)` | OpenAI-compatible API key. Falls back to mock questions when unset |
| `OPENAI_API_KEY` | - | Fallback if `AI_API_KEY` is not set |
| `AI_BASE_URL` | `https://api.openai.com/v1` | API base URL for OpenAI-compatible providers |
| `OPENAI_BASE_URL` | - | Fallback if `AI_BASE_URL` is not set |
| `AI_MODEL` | `gpt-4o-mini` | Model name for question generation |
| `AI_MAX_TOKENS` | `2000` | Max tokens per generation request |
| `AI_TIMEOUT` | `30000` | Request timeout in milliseconds |
| `REACT_APP_API_URL` | `/api` | API base URL for frontend (used for proxy) |
| `MONGODB_URI` | `mongodb://localhost:27017/fln` | MongoDB connection string |
| `JWT_SECRET` | - | JWT signing secret |

## Setup Instructions

### Prerequisites
- Node.js 18+
- MongoDB 6+
- npm

### Install & Run

```bash
# Install dependencies
cd server && npm install
cd client && npm install

# Seed demo data
cd server && node seed.js

# Start backend (port 5000)
cd server && node index.js

# Start frontend (port 3000, proxies to :5000)
cd client && npm start
```

### Demo Login

| Role | Email | Password |
|------|-------|----------|
| Teacher | `gps-mt-001.t01@fln.org` | `Teacher@123` |

### AI Integration

Set `AI_API_KEY` in `server/.env` to enable real AI generation:

```
AI_API_KEY=your-openai-api-key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

Without an API key, the system falls back to mock questions — the app remains fully functional for UI testing.

## Future Improvements

- Batch PDF download for all worksheets in a class
- Customizable question count per student
- Support for additional subjects (Language, EVS)
- AI model fine-tuning on curriculum-specific data
- Real-time generation progress via WebSocket
- Cached AI responses for identical parameters
- Pagination for worksheet history
