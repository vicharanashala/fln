# FLN — AI Answer Key Generator Platform (MERN)

A production-ready, focused **AI Answer Key & Assessment Template Generator** for the Foundational Literacy & Numeracy (FLN) Assessment Platform.

---

## 🌟 Overview
The platform focuses entirely on the AI-powered assessment template generation and review workflow. Users can upload assessment question papers in PDF or image format, trigger the AI processing pipeline, review and edit extracted questions/options, and download a finalized printable PDF answer key.

All login screens, dashboard statistics, and student/school database pages have been removed to isolate and focus on the AI Answer Key Generator module.

---

## 🚀 Tech Stack

### Frontend
| Tech | Version | Purpose |
|---|---|---|
| **React** | 18.3 | UI framework |
| **TypeScript** | 5.6 | Type safety |
| **Vite** | 5.4 | Build tool & dev server |
| **Tailwind CSS** | 4.0 | Styling |
| **React Router** | 6.26 | Routing |
| **TanStack Query** | 5.59 | Data fetching & caching |
| **Axios** | 1.7 | HTTP client |
| **Framer Motion** | 11.11 | Animations |
| **Lucide Icons** | 0.441 | Icon system |
| **React Hot Toast** | 2.4 | Notifications |

### Backend
| Tech | Version | Purpose |
|---|---|---|
| **Node.js** | 18+ | Runtime |
| **Express.js** | 4.19 | Web framework |
| **MongoDB** | 8.x | Database (via Mongoose 8.5) |
| **Morgan** | 1.10 | Request logging |
| **CORS** | 2.8 | Cross-origin support |

### Python Service
| Tech | Version | Purpose |
|---|---|---|
| **FastAPI** | 0.110+ | Web framework for processing endpoints |
| **PyMuPDF** | 1.24+ | PDF extraction & page rendering to image |
| **Groq / Llama Vision** | - | Vision LLM for structured QA extraction |

---

## 📂 Simplified Folder Layout
```
FLN-Project/fln/
├── frontend/                           ← React + TS + Tailwind v4  (port 5173)
│   ├── src/
│   │   ├── main.tsx                    ← App bootstrap (QueryClient, Toaster, Theme providers)
│   │   ├── App.tsx                     ← Simplified Router (AI Answer Key routes)
│   │   ├── index.css                   ← Tailwind + custom design system
│   │   ├── layouts/
│   │   │   └── DashboardLayout.tsx     ← Sidebar + Topbar wrapper
│   │   ├── contexts/
│   │   │   └── ThemeContext.tsx        ← Light/dark mode
│   │   ├── services/
│   │   │   └── assessmentApi.ts        ← API client for assessments and templates
│   │   ├── pages/
│   │   │   └── AnswerKeyGenerator/
│   │   │       ├── AssessmentsListPage.tsx  ← List assessments, upload files, trigger AI
│   │   │       └── TemplateReviewPage.tsx  ← Edit questions, bounding boxes & export PDF
│   └── package.json
│
├── backend/                            ← Express + MongoDB API  (port 5000)
│   ├── src/
│   │   ├── server.js                   ← Express bootstrap
│   │   ├── middleware/auth.js          ← Bypassed auth middleware (auto-superadmin context)
│   │   ├── controllers/
│   │   │   ├── assessmentController.js  ← Handles assessment file uploads and templates
│   │   │   └── templateController.js    ← Handles template saves, approval, and regeneration
│   │   └── routes/
│   │       ├── assessmentRoutes.js
│   │       └── templateRoutes.js
│   └── package.json
│
└── python-service/                     ← FastAPI + AI extraction service (port 5051)
    ├── main.py                         ← FastAPI server
    ├── services/
    │   ├── pdf_processor.py            ← PDF to JPEG and image-cropping utilities
    │   └── groq_service.py             ← LLM Vision API client wrapper
    └── requirements.txt
```

---

## 🗄️ Database
This project uses the MongoDB database: **`fln_answerkey`**
```
mongodb://127.0.0.1:27017/fln_answerkey
```

---

## ⚙️ Setup & Run

### Prerequisites
*   Node.js 18 or later
*   MongoDB running locally
*   Python 3.8+ with `pip`
*   Groq API Key (saved in python-service `.env` as `GROQ_API_KEY`)

### 1. Backend
```bash
cd backend
cp .env.example .env              # Edit MONGO_URI if needed
npm install
npm run dev                       # starts on http://localhost:5000
```

### 2. Python Service
```bash
cd python-service
cp .env.example .env              # Set your GROQ_API_KEY
pip install -r requirements.txt
python3 main.py                   # starts on http://localhost:5051
```

### 3. Frontend
```bash
cd frontend
cp .env.example .env              # Set VITE_API_URL=http://localhost:5000/api
npm install
npm run dev                       # starts on http://localhost:5173
```
Open **http://localhost:5173** in your browser.

---

## 🔑 4. Login Feature Removal (Bypassed)
All authentication requirements have been bypassed to simplify testing:
*   **Backend:** All requests are automatically authenticated under a `superadmin` user context. If no superadmin user exists in MongoDB, it is created automatically on the first request (`superadmin@fln.org`).
*   **Frontend:** The UI initializes pre-authenticated with the mock Super Admin profile. All logout buttons (Sidebar, Topbar, Profile page) have been removed.

---

## ✨ AI Template Generator Features
*   **4-Phase Pipeline:** Upload → Process → Review → Approve.
*   **Bounding Box Cropping:** The Python service extracts normalized bounding boxes relative to page coordinates and crops question images for visual preview in the review editor.
*   **Regenerate Single Question:** Target and re-extract individual questions with custom prompts or suggestions from the review screen.
*   **PDF Export:** Download a printable PDF of the approved answer key directly from the browser.

---

## 🔧 Development Scripts

### Frontend
```bash
npm run dev         # Vite dev server
npm run build       # Build production assets
npm run typecheck   # Typecheck TypeScript (tsc -b --noEmit)
```

### Backend
```bash
npm start           # start node server
npm run dev         # start nodemon server
```
