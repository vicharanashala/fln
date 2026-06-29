# FLN Pipeline — Big Picture

VISE Internship (IIT Ropar) | Prof. Sudarshan Iyengar

```
Author : Pradip Kumar Acharya
Role   : Project FLN (youngest member, 1st yr completed)
Goal   : Automate generation of adaptive FLN worksheets for primary school students (Classes 1-3)
```

---

## 1. The Core Asset: Question Bank

Every worksheet starts here. Each question is tagged with:

| Tag | Example | Purpose |
|---|---|---|
| Level | 24 | Which FLN skill level |
| Sub-level | 24.0 (Mastery), 24.1 (Easier), 24.2 (Further) | Adaptive difficulty |
| Strand | Place Value, Number Sense, Operations | Topic grouping |
| Class | 1, 1-2, 2, 2-3, 3 | Curriculum alignment |
| Question text | "Circle the number in tens place" | The actual content |
| Illustration | image_L24_0_01.png | Visual aid for question |
| Answer | 9 | Key for auto-grading |
| Prerequisites | Level 12 (Tens and Ones) | Dependency tracking |

**Scale:** 32 levels × 3 sub-levels × ~10-20 questions = 1000+ questions growing indefinitely.

---

## 2. The Full Pipeline (End-to-End)

```
                        CONFIG
                      (by admin)
                          │
              ┌───────────▼───────────┐
              │   Admin UI (Streamlit) │
              │ + Google Doc filename  │
              │ + Level / Topic        │
              │ + Sub-levels needed    │
              │ + Question count       │
              └───────────┬───────────┘
                          │
              ┌───────────▼───────────┐
              │   config.json         │
              │   (single source of   │
              │    truth for run)     │
              └───────────┬───────────┘
                          │
              ┌───────────▼───────────┐
              │   ORCHESTRATOR        │
              │   (fln_pipeline.py)   │
              │                       │
    ┌─────────┼─────────┬─────────┬──┘
    ▼         ▼         ▼         ▼
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│ IMAGE│ │TEXT  │ │ANSWER│ │ DOC │
│ SCRAP│ │GENERA│ │ KEY  │ │FORMAT│
│ (auto│ │ TOR  │ │ WRITE│ │TER   │
│  fall)│ │      │ │  R   │ │      │
└──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘
   │        │        │        │
   └────────┴────────┴────────┘
                  │
       ┌──────────▼──────────┐
       │  Google Docs API    │
       │  (Cambria font,     │
       │  clean tables,      │
       │  print-ready B&W)   │
       └──────────┬──────────┘
                  │
       ┌──────────▼──────────┐
       │  Google Doc output  │
       │  → Print / PDF      │
       └─────────────────────┘
```

### Stage by stage:

| Stage | Input | Output | Tool |
|---|---|---|---|
| **Scrape** | Level config, search queries | Downloaded images (organized by level/sub-level) | Bing + DuckDuckGo + Wikimedia scrapers |
| **Generate Text** | Level config, count | Question text for each Q No. | Python (template-based or LLM) |
| **Write Answer Key** | Same config | Answer key (teacher copy) | Python + logic rules |
| **Format Doc** | Images + text + answers | Google Doc (styled, Cambria, tables) | Google Docs API (`google-api-python-client`) |
| **Adaptive** | Student previous exam results | Personalized question set | AI rules → filter question bank by tags |

---

## 3. Adaptive Learning (The Grand Finale)

```
Student takes exam
       │
       ▼
Score analysed per strand
       │
       ▼
Weak topics identified
  (e.g., Carry Addition: 30%)
       │
       ▼
AI picks relevant levels + sub-levels
  (Level 25, Easier Remediation)
       │
       ▼
Questions pulled from bank
       │
       ▼
Personalized worksheet generated
       │
       ▼
→ Teacher prints, student practices
→ Retake → Re-evaluate → Next level
```

**How AI decides:**
- Simple: If score < 50% in Level X → generate Level X.1 (Easier Remediation)
- Medium: Tag each question by exact skill → pinpoint micro-skill gaps
- Advanced (future): LLM reads wrong answers, writes new questions targeting the exact mistake

---

## 4. Adding New Levels (Scalability)

To add Level 33, the admin only needs to:

1. Add to `levels_config.json`:
```json
{
  "number": 33,
  "name": "Fractions (Halves & Quarters)",
  "class_range": "3",
  "nipun_strand": "Number Operations",
  "is_review": false,
  "image_count": { "0": 12, "1": 10, "2": 8 }
}
```

2. Add search queries to `queries_config.json`

3. Add question templates to `question_templates.json`

**Zero code changes.** The pipeline reads config and adapts automatically.

---

## 5. Directory Structure (Proposed)

```
FLN/
├── fln_pipeline.py           # Main orchestrator
├── stages/
│   ├── scraper.py            # Image download logic
│   ├── question_generator.py # Question text generation
│   ├── answer_key.py         # Answer key writer
│   └── docs_formatter.py     # Google Docs API writer
├── config/
│   ├── levels_config.json    # All level definitions
│   ├── queries_config.json   # Search terms per level
│   └── question_templates.json # Question templates
├── admin_ui/
│   └── streamlit_app.py      # Streamlit frontend
├── output/                   # Generated files
│   ├── pinterest_images/
│   └── fln_table_rows.csv
└── notebooks/                # Original dev notebooks
    ├── fln_image_scraper.ipynb
    └── fln_level_populator.ipynb
```

---

## 6. Tech Stack Summary

| Component | Choice | Reason |
|---|---|---|
| Admin UI | **Streamlit** | One Python file, free deploy, no build step |
| Backend | **Python** | All existing code is Python |
| Image scraping | Bing + DDG + Wiki | Free, no API keys needed |
| Google Docs | `google-api-python-client` | Direct API write with full formatting |
| Google Drive | For storage | Mount in Colab, persist across sessions |
| AI/Adaptive | Rules engine (v1), LLM (future) | Simple threshold logic first |
| Hosting | Streamlit Cloud + GitHub | Free, auto-deploys from repo |

---

## 7. Current Status (June 2026)

| Feature | Status |
|---|---|
| Level structure (1-32) | Done |
| Question templates | Partially (DOCX files exist) |
| Image scrapers | Working (Bing + DDG + Wiki) |
| Level populator | Working (generates CSVs + metadata) |
| Google Docs format | Not started |
| Admin UI | Not started |
| Adaptive engine | Not started |
| Unified orchestrator | Not started |

---

## 8. Why This Architecture Works

1. **Config-driven** — Adding levels = editing JSON, not Python
2. **Modular** — Each stage is its own function, testable in isolation
3. **Colab-friendly** — Every script runs in Colab's free tier; zero cost
4. **Print-ready** — Output is a styled Google Doc; teacher just clicks Print
5. **Extensible** — Adaptive AI plugs in as a pre-processing filter on the question bank
