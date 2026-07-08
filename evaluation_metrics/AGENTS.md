# FLN Evaluation System — Project Memory

## Project Overview
AI-powered pipeline to evaluate children's Foundational Learning Numeracy (FLN) skills per the Indian NIPUN Bharat curriculum. Classes 1–4, 3 phrases per class.

## What Exists

### Core Pipeline (`evaluation_metrics/`)
- **`scripts/`** — 4-stage evaluation: classify questions, compare answers, evaluate child, generate report (uses Groq API)
- **`prompts/`** — LLM prompt templates for each stage
- **`syllabus/`** — Curriculum syllabi per class+phrase (class_1_syllabus_phrase1/2/3, etc.)
- **`questions/`** — Question banks per class+phrase (class_{n}_exam_{phrase}.json)
- **`student_responses/`** — Student answer files
- **`evaluation_reports/`** — Previously generated evaluations
- **`run_pipeline.py`** — Main evaluation pipeline script

### Personalized Evaluation (built last session)
- **`personalized_evaluation_pipeline.py`** — Checks existing evaluations; if child failed, generates personalized next-phrase exam
  - **Logic**: Failed phrase_1 → personalized phrase_2 (reuses failed Qs + 4 new levels)
  - Failed phrase_2 → personalized phrase_3 (reuses failed Qs + all new levels)
  - Failed phrase_3 → personalized next-class phrase_1 (only failed Qs, syllabi same)
  - Pass → no exam
  - **Output**: `personalized_evaluation/class_X/<student_id>/class_Y_<target_phrase>/`
- **`personalized_evaluation/`** — Generated personalized exams + response templates

## Key Decisions
- Personalized exam reuses *exact same questions* the child failed, not new questions on same topic
- New levels from target syllabus (subtopic_names not in current syllabus) are added when staying in same class
- Folder path includes target class to disambiguate (e.g., `class_2_phrase_1/`)

## Next Steps / Pending
- (Add new tasks here as they come up)

## Usage
```bash
# Evaluate a student
python3 run_pipeline.py <class_num> <phrase> <student_id>

# Generate personalized exam after failure
python3 personalized_evaluation_pipeline.py <student_id> <class_num> [phrase]
```
