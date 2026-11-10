# ai-services

## Overview
Python tooling that evaluates children's FLN (foundational literacy and numeracy)
exam responses and builds follow-up exams. The flow is: compare a student's
answers to the question bank, have an LLM evaluate the child against the
syllabus, produce a report card, and, for a failed phrase, generate a
personalized next-phrase exam. For the full flow, see
[`PIPELINE.md`](./PIPELINE.md) (human-maintained). Data directories
(`questions/`, `syllabus/`, `prompts/`, `personalized_evaluation/`, `scratch/`)
hold JSON, prompt text and scans only and have no contracts of their own. The backend uses this directory only to rasterize PDFs: `backend/src/routes/evaluation.ts` spawns `scripts/pdf_rasterize.py` (interpreter from `PYTHON_BIN`, directory from `AI_SERVICES_DIR`, both read in `backend/src/config.ts`) and writes its temporary PDFs and page images into `scratch/`. No backend code invokes `run_pipeline.py` or `personalized_evaluation_pipeline.py`.

## Interface
- [`scripts/`](./scripts/README.md): stage modules `0_auto_classify_questions`, `1_compare_answers`, `2_evaluate_child`, `3_generate_report`, shared LLM client `_api.py`, and `pdf_rasterize.py`.
- `run_pipeline.py`: CLI `python run_pipeline.py <class_num> <phrase> <student_id> [model]` (default model `llama-3.1-8b-instant`). Loads the numbered scripts via `importlib`, reads `student_responses/class_<n>/<phrase>/<student_id>.json`, runs compare, then evaluate (up to 3 attempts, 10 s apart), then report. Exits 1 on a missing file or failed evaluation. Known behaviour: `ChildEvaluator.evaluate` returns `None` after a successful LLM JSON parse (`scripts/2_evaluate_child.py:269-276`), so only the PASS and RETEST short-circuits return a result; any other student ends with "Evaluation failed after 3 attempts" and exit 1.
- `personalized_evaluation_pipeline.py`: CLI `python personalized_evaluation_pipeline.py <student_id> <class_num> [phrase]`. Functions: `determine_next_phrase`, `load_question_bank`, `load_syllabus`, `get_subtopic_names`, `find_evaluation`, `find_comparison`, `find_student_response`, `get_failed_questions`, `get_questions_for_subtopic_names`, `run_pipeline(student_id, class_num, phrase, student_name=None)`. It returns a summary dict, or `None` if the student passed or inputs are missing.
- `run_evaluation_c2p2.py`: one-off script for a single class 2 / phrase 2 student. It is not a general entry point.
- `requirements.txt`: `requests`, `pypdf`, `pymupdf`.

## Invariants
- Phrase progression is `phrase_1 -> phrase_2 -> phrase_3 -> next class phrase_1`.
- The personalized exam contains the exact questions the child got wrong (marked `✗` in the comparison file) plus questions for subtopics in the target phrase's syllabus that are absent from the current phrase's syllabus; if the syllabi match, only the failed questions are included. New-subtopic questions are added only when the target class equals the current class (phrase_1 -> phrase_2 and phrase_2 -> phrase_3); on phrase_3 -> next class phrase_1 only the failed questions are used (`personalized_evaluation_pipeline.py:183-190`). If no questions end up selected, the whole target-class exam is used as a fallback (`:213-218`).
- A student whose evaluation has `fln_status == "pass"` or `decision == "PASS"` gets no personalized exam.
- Expected input layout: `questions/class_<n>/<phrase>/class_<n>_exam_<phrase>.json`, `syllabus/class_<n>/class_<n>_syllabus_phrase<m>.json`, `evaluation_reports/class_<n>/<phrase>/{comparison,evaluation,reports}/`, `student_responses/class_<n>/<phrase>/`.
- `student_responses/`, `evaluation_reports/`, `personalized_evaluation/`, `models/`, `.cache/`, `.env` and `__pycache__/` are git-ignored (root `.gitignore:36-38,54`); they exist only locally, so generated personalized exams are not committed.
- `run_evaluation_c2p2.py` hard-codes `/home/shreya/fln/evaluation_metrics` and imports modules named without numeric prefixes (`compare_answers`, `evaluate_child`, `generate_report`), so it will not run as-is in this repo.

## Side Effects
- Network calls to the Groq API (Gemini as fallback) from stages 0, 2 and 3; keys come from `GROQ_API_KEY` / `GEMINI_API_KEY` in the environment or `.env`.
- `run_pipeline.py` creates `evaluation_reports/class_<n>/<phrase>/{comparison,evaluation,reports}/` and writes dated JSON and text files there.
- `personalized_evaluation_pipeline.py` writes `personalized_evaluation/class_<n>/<student_id>/class_<t>_<phrase>/<student_id>_<phrase>_personalized_exam.json` and `..._response_template.json`.
- Question classification (`scripts/0_auto_classify_questions.py`) rewrites matching files in place and writes `.json.bak` copies. It globs `question_*.json` and `*_exam.json` directly under each class folder, so it matches nothing in the shipped `questions/class_<n>/<phrase>/class_<n>_exam_<phrase>.json` layout and leaves the shipped data unchanged.

## Verification
- Lint: `npm run lint` at the repository root (does not cover Python). Root `npm test` is not defined.
- No Python test runner is configured; placeholder: `<test-command>`.
- Smoke check: `python run_pipeline.py` with no arguments prints usage and exits 1.
