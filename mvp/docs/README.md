# FLN Teacher Documentation

This directory documents the complete teacher workflow in the FLN Assessment Portal.

## Files

| File | Description |
|---|---|
| `teacher-workflow-overview.md` | Full menu of teacher features with navigation map |
| `teacher-diagnostic-workflow.md` | Step-by-step diagnostic test (Run Diagnostic) |
| `teacher-worksheet-workflow.md` | Worksheet generation, PDF, ICR ingestion, grading |
| `teacher-bulk-diagnostic.md` | Bulk diagnostic PDF generation for a class |
| `teacher-icr-scanner.md` | Simulated ICR scanner with animated flow |
| `teacher-api-endpoints.md` | All server API endpoints available to teacher |
| `teacher-governance-rules.md` | SRS governance rules enforced for teachers |

## Quick Start

1. Start server: `npm run dev`
2. Open: `http://localhost:3000/`
3. Login as any teacher (e.g. `gps-mt-001.t01@fln.org` with a complex password)
4. Core flows: Run Diagnostic → Worksheet Workflow → Bulk Diagnostic → ICR Scanner
