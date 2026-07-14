# Teacher Workflow — Overview

This document describes every feature, action, and screen available to a **Teacher** role in the FLN Assessment Portal.

---

## Login

- **URL:** `http://localhost:3000/`
- **Credentials:** Any `@fln.org` email with password meeting complexity rules (>= 8 chars, uppercase, digit, special char).
- **Example teacher accounts:**
  - `gps-mt-001.t01@fln.org` — Ritu Sharma (GPS Model Town Ludhiana)
  - `gps-amb-003.t01@fln.org` — Meena Kumari (GPS Cantt Ambala)
  - `gps-bth-006.t01@fln.org` — Harpreet Kaur (GPS Bathinda)

---

## Navigation

| Sidebar Item | View Key | Description |
|---|---|---|
| **Dashboard** | `workspace` | Main teacher dashboard |
| **Assessment > Diagnostic Test** | `diagnostic_test` | Run diagnostic on a student |
| **Assessment > Adaptive Test** | `adaptive_test` | Interactive test |
| **Assessment > Test History** | `test_history` | Past test results |
| **Students > Student List** | `student_list` | Searchable student table |
| **Students > Student Profile** | `student_profile` | Detailed student drill-down |
| **Students > Performance** | `performance` | Performance charts |
| **Worksheets** | `worksheets` | WorksheetWorkflow |
| **Reports** | `reports` | (placeholder) |
| **Notifications** | `notifications` | System announcements |
| **Settings** | `settings` | Account preferences |

---

## Main Dashboard Features

### 1. Class Picker Tabs
Filter the dashboard to a specific class (e.g. "Class 2 - A", "Class 3 - A").

### 2. Register New Student
Onboard a student by providing Name, Age, and Aadhar number. Auto-assigned to the selected class.

### 3. 59 FLN Framework Modal
Browse all 59 FLN levels across Preschool 1–4 through Class 4 with search and filter.

### 4. Student Roster Table
Searchable table of all students showing ID, Name, Aadhar (masked), Current Level, Target Level, Streak, and action buttons.

### 5. Bulk Paper Generator (Quick Action)
Shows counts of pending diagnostics vs placed students. "Generate All Assessment Sheets" button.

---

## Core Workflows

| Workflow | Entry Point | Description |
|---|---|---|
| **DiagnosticWorkflow** | "Run Diagnostic" button on unplaced student | Multi-step: generate paper → fill answers → submit & grade → view placement |
| **WorksheetWorkflow** | "Open Personalization Portal" button | Full lifecycle: generate cycle worksheets → timing monitor → print PDF → ICR ingestion → grading |
| **BulkDiagnosticWorkflow** | "Bulk Diagnostic Generator" button | Generate diagnostic PDFs for entire class (async job with progress polling) |
| **IcrScanner** | "ICR Answer Sheet Scanner" button | Simulated scanner with animation → verify answers → submit & evaluate |
| **Print Level Worksheet** | "Print Lx.y" button on placed student | Generates level-wise PDF for one student |
| **Interactive Worksheet** | "Interactive" link on placed student | Opens browser-based interactive worksheet |
