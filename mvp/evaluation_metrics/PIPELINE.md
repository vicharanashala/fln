# FLN Evaluation Pipeline — Integration Guide

## Overview

AI-powered pipeline to evaluate children's Foundational Learning Numeracy (FLN) skills (NIPUN Bharat curriculum, Classes 1–4, 3 phrases per class). Takes a student's scanned answer sheet → compares against expected answers → evaluates via LLM → generates report → optionally creates remedial exam.

---

## Directory Structure

```
evaluation_metrics/
├── run_pipeline.py                    # Main entry point
├── personalized_evaluation_pipeline.py # Remedial exam generator
├── .env.example                       # Template: GROQ_API_KEY=xxx
├── requirements.txt                   # requests>=2.31.0
│
├── scripts/
│   ├── _api.py                        # Shared Groq API utility (retry, rate-limit, TPM handling)
│   ├── 0_auto_classify_questions.py   # Classify questions against curriculum
│   ├── 1_compare_answers.py           # Compare student answers vs expected
│   ├── 2_evaluate_child.py            # Evaluate child via LLM (determine level, root causes)
│   └── 3_generate_report.py           # Generate report card
│
├── prompts/
│   ├── classify_question.txt          # Prompt: classify a question by topic/subtopic/level
│   ├── evaluate_child.txt             # Prompt: analyze wrong answers, assign FLN level
│   └── generate_report.txt            # Prompt: create teacher-friendly report
│
├── questions/
│   └── class_{1..4}/
│       ├── phrase_{1..3}/class_{n}_exam_phrase_{m}.json   # Question banks
│       └── question_*.json                                 # Individual questions (optional)
│
├── syllabus/
│   └── class_{1..4}/class_{n}_syllabus_phrase{m}.json     # Curriculum per class+phrase
│
├── student_responses/
│   └── class_{n}/{phrase}/{student_id}.json               # Student answer input
│
├── evaluation_reports/                # Auto-generated outputs (regenerated each run)
│   └── class_{n}/{phrase}/
│       ├── comparison/{id}_comparison_{date}.json
│       ├── evaluation/{id}_evaluation_{date}.json
│       └── reports/{id}_report_{date}.txt
│
└── personalized_evaluation/           # Auto-generated remedial exams
    └── class_{n}/{student_id}/class_{target}_{phrase}/
        ├── {id}_{phrase}_personalized_exam.json
        └── {id}_{phrase}_response_template.json
```

---

## Pipeline Flow

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐     ┌──────────────┐
│ Step 1      │     │ Step 2       │     │ Step 3     │     │ Step 4       │
│ Compare     │────▶│ Evaluate     │────▶│ Generate   │────▶│ Personalized │
│ Answers     │     │ Child (LLM)  │     │ Report     │     │ Exam (if     │
│ (local)     │     │              │     │            │     │ failed)      │
└─────────────┘     └──────────────┘     └────────────┘     └──────────────┘
```

### Step 1 — Compare Answers (`1_compare_answers.py`)
- Reads student response JSON and loads question bank for that class
- Compares each student answer vs expected answer (string equality)
- Output: comparison file with correct/wrong counts, grouped by difficulty

### Step 2 — Evaluate Child (`2_evaluate_child.py`)
- If Easy >= 90% AND Medium >= 50% AND Hard >= 40% → **PASS** (no API call)
- Otherwise → calls Groq LLM with wrong answers + syllabus
- LLM returns: root causes, failed FLN levels, assigned level (minimum failure level rule)
- Output: evaluation JSON with placement, topics to focus, recommendation

### Step 3 — Generate Report (`3_generate_report.py`)
- If PASS/RETEST → uses template (no API call)
- Otherwise → calls Groq LLM to create teacher-friendly report card
- Falls back to template report if API fails
- Output: `.txt` report card

### Step 4 — Personalized Exam (`personalized_evaluation_pipeline.py`)
- Checks if child failed (FLN status = fail)
- Collects exact failed questions + new-level questions from target phrase
- Generates personalized exam + blank response template
- No API calls — pure local logic

---

## File Formats

### Student Response (input)
```json
{
  "student_id": "STU_001",
  "student_name": "Aditya",
  "enrolled_class": 1,
  "test_date": "2026-07-08",
  "phrase": "phrase_1",
  "exam_id": "C1_WORKSHEET_PHRASE_1",
  "answers": {
    "Q1": {"answer": "3", "confidence": 0.95},
    "Q2": {"answer": "Circle", "confidence": 0.85}
  }
}
```

### Question Bank (reference)
```json
{
  "exam_id": "C1_WORKSHEET_PHRASE_1",
  "class": 1,
  "phrase": "phrase_1",
  "total_questions": 51,
  "questions": [
    {
      "question_id": "Q1",
      "question": "Count the stars: ★★★ How many?",
      "answer": 3,
      "answer_type": "numeric",
      "topic": "Number Sense",
      "subtopic": "Counting",
      "class_level": 1,
      "difficulty": "easy",
      "source_level": "Preschool 1"
    }
  ]
}
```

### Syllabus
```json
{
  "class": 1,
  "phrase": "phrase_1",
  "topics": [
    {
      "topic": "Number Sense",
      "subtopics": [
        {"subtopic_name": "One-to-One Correspondence", "levels": [1,2,3]}
      ]
    }
  ]
}
```

---

## Running

```bash
# 1. Set API key
cp .env.example .env   # Add your GROQ_API_KEY

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run evaluation pipeline
python3 run_pipeline.py <class> <phrase> <student_id> [model]

# Example: evaluate a Class 1, Phrase 1 student
python3 run_pipeline.py 1 phrase_1 STU_001

# Example: use a different model
python3 run_pipeline.py 1 phrase_1 STU_001 llama-3.3-70b-versatile

# 4. Generate personalized exam (if child failed)
python3 personalized_evaluation_pipeline.py <student_id> <class> [phrase]

# Example:
python3 personalized_evaluation_pipeline.py STU_001 1 phrase_1
```

---

## Key Logic

### Minimum Failure Level Rule
If a child fails at multiple FLN levels (e.g., Level 3 and Level 5), assign them to the **lowest** failing level. Higher skills depend on foundational levels.

### Personalized Exam Logic
| Current → Target | Action |
|---|---|
| phrase_1 → phrase_2 | Reuse failed Qs + 4 new levels from target |
| phrase_2 → phrase_3 | Reuse failed Qs + all remaining levels |
| phrase_3 → next class phrase_1 | Reuse failed Qs only (syllabi same) |

### Pass Thresholds
| Difficulty | Required |
|---|---|
| Easy | >= 90% |
| Medium | >= 50% |
| Hard | >= 40% |

---

## API Configuration

The pipeline uses Groq API. Configure via `.env`:

```
GROQ_API_KEY=gsk_your_key_here
```

Free tier TPM limits:
| Model | TPM Limit |
|---|---|
| `llama-3.1-8b-instant` | 6000 |
| `llama-3.3-70b-versatile` | 6000 (higher on paid) |

The shared API utility (`scripts/_api.py`) handles retries, rate limits, and TPM errors automatically.

---

## Adding New Content

- **New questions**: Create `questions/class_{n}/phrase_{m}/class_{n}_exam_phrase_{m}.json`
- **New syllabus**: Create `syllabus/class_{n}/class_{n}_syllabus_phrase{m}.json`
- **New student**: Place JSON in `student_responses/class_{n}/{phrase}/{student_id}.json`
