# ai-services/scripts

## Overview
Stage modules of the FLN evaluation pipeline plus two helpers. Numbered files
run in order: classify questions (0), compare student answers to the key (1),
evaluate the child with an LLM (2), generate a report card (3). `_api.py` is the
shared LLM client and `pdf_rasterize.py` converts scanned PDFs to JPEG for OCR.
Filenames start with a digit, so they cannot be imported with `import`; callers
load them with `importlib` (see [`../run_pipeline.py`](../run_pipeline.py)).

## Interface
- `_api.py`: `groq_api_call(model, messages, temperature=0.1, max_tokens=5000, timeout=300, api_key=None, max_retries=5, base_delay=2, stream=False)` returns the OpenAI-style response dict or `None`. Retries on HTTP 429, 500, 502 and 503, on timeouts, and on `ConnectionError`/`RequestException`; halves `max_tokens` on 413/context-length errors, and falls back to Gemini (`gemini-2.0-flash`, then `gemini-2.5-flash`) when `GROQ_API_KEY` is missing or rejected (401). `_call_gemini_fallback(...)` is the private fallback; it forces `maxOutputTokens=max(8000, max_tokens)` and sets `responseMimeType` to JSON when any message contains "json". `.env` parsing differs: `ai-services/.env` values are used as written, while the repo-root `.env` has surrounding single or double quotes stripped.
- `0_auto_classify_questions.py`: `QuestionClassifier(model, api_key)` with `.classify(question_text)` and `.process_all(questions_dir="questions")`. CLI: `python scripts/0_auto_classify_questions.py [questions_dir]`.
- `1_compare_answers.py`: `AnswerComparator(auto_save=True)` with `.compare(student_response_file)`; builds `questions_db` from `question_*.json` and `*_exam_*.json` under `questions/class_<n>`; for ids missing from the bank it falls back to the question metadata in `student_data["questions"]` (`:84-90`). The comparison `decision` is `RETEST`, `PLACE_AT_LEVEL` or `EVALUATE` (`_determine_decision`, `:139-155`: only when wrong % <= 10 can it be `RETEST` or `PLACE_AT_LEVEL`); `PLACE_AT_LEVEL` is not handled specially by stages 2 or 3. CLI: `python scripts/1_compare_answers.py <student_response_file>`.
- `2_evaluate_child.py`: `ChildEvaluator(model, api_key, auto_save=True)` with `.evaluate(comparison_file, syllabus_file)`; returns the result dict or `None`. Short-circuits (no LLM call) to a `RETEST` result when the comparison decision is `RETEST`, to a `PASS` result when easy >= 90%, medium >= 50% and hard >= 40% (`:75-96`), and to a `PASS` result when every answer is correct (`:106-127`). Otherwise it sends at most 12 wrong answers (`max_tokens=800`, `timeout=300`) and, if the API returns nothing, builds a deterministic fallback evaluation (`:193-257`). Known behaviour: after a successful JSON parse it prints and returns `None` (`:269-276`), so the LLM path never yields a result. Prompt template: `../prompts/evaluate_child.txt`.
- `3_generate_report.py`: `ReportGenerator(model, api_key)` with `.generate(evaluation_file, student_name="Student")`, which sets `.report` and calls `._save_report(eval_data, student_name)`. `RETEST` and `PASS` decisions use local templates; otherwise the LLM writes the report, and `_generate_template_report` is the fallback when the API call fails or returns nothing. CLI: `python scripts/3_generate_report.py <evaluation_file> [student_name]`.
- `pdf_rasterize.py`: CLI `python scripts/pdf_rasterize.py <input_pdf> <output> [--all-pages | --page N]`. Prints exactly one JSON line on stdout. Single page: `success`, `output_path`, `page_size`, `raster_size`; the output path is forced to the `.jpg` suffix. `--all-pages`: `success`, `page_count`, `pages` (each with its own `page_size` and `raster_size`) and, if any page failed, `page_errors`. The argparse help text still says "PNG", but the files are JPEG.

## Invariants
- `BASE_DIR` is the parent of `scripts/` (`ai-services/`); all data paths (`questions/`, `prompts/`, `syllabus/`, `evaluation_reports/`) resolve from it, not from the current directory.
- `_api.py` loads `ai-services/.env` and then the repo-root `.env` at import time, using `os.environ.setdefault`, so existing environment variables win.
- LLM stages expect JSON-only replies; the classifier strips Markdown code fences before parsing and returns `None` on a parse failure.
- `pdf_rasterize.py` stdout must stay a single JSON line because the Node backend parses it; do not add other prints, and import PyMuPDF as `pymupdf`, not `fitz`. Renders at 200 DPI, JPEG quality 85, with the longer side capped at 3500 px. The `--all-pages` mode writes `page_<n>.jpg` and skips pages that fail.
- Wrong answers are marked with the character `✗` in comparison files; downstream stages (including `../personalized_evaluation_pipeline.py`) match on it.
- Comparison, evaluation and report files are named `<student_id>_<kind>_<test_date>`.

## Side Effects
- Network: HTTPS POSTs to `api.groq.com` and, as fallback, `generativelanguage.googleapis.com`. Sleeps and retries make calls slow (the classifier sleeps 2 s after each successfully parsed reply).
- `0_auto_classify_questions.py` rewrites `question_*.json` and `*_exam.json` files found directly under each class folder in place, copying the original to a `.json.bak` file first. The shipped layout is `questions/class_<n>/<phrase>/class_<n>_exam_<phrase>.json`, which neither glob matches, so it changes nothing there.
- Stages 1-3 with `auto_save` write to `ai-services/evaluation_reports/`. Note that the legacy `_save_*` paths are flat (`evaluation_reports/<student_id>_..._<date>`), whereas `../run_pipeline.py` passes `auto_save=False` and writes to the nested `class_<n>/phrase_<m>/` layout itself.
- `pdf_rasterize.py` writes JPEG files and creates output directories.
- Known drift: the `__main__` blocks of `2_evaluate_child.py` and `1_compare_answers.py` print usage strings that do not match each other (the former takes `<student_id> <class_num> [phrase]`); prefer `../run_pipeline.py`. The `2_evaluate_child.py` block also builds the syllabus path as `class_<n>_syllabus_<m>.json` without the `phrase` prefix (`:404`), so it cannot find the real `class_<n>_syllabus_phrase<m>.json` files.

## Verification
- Lint: `npm run lint` at the repository root (it does not cover Python).
- No Python test runner is configured; placeholder: `<test-command>`.
- Smoke check: `python scripts/pdf_rasterize.py sample.pdf /tmp/out.jpg` should print one JSON line.
