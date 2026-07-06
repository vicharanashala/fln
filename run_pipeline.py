import json, sys, os, time, importlib.util
from pathlib import Path

BASE = Path(__file__).resolve().parent / "evaluation_metrics"
SCRIPTS = BASE / "scripts"

def load_mod(path, name):
    s = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m

comp = load_mod(SCRIPTS / "1_compare_answers.py", "c1")
ev   = load_mod(SCRIPTS / "2_evaluate_child.py",   "c2")
rep  = load_mod(SCRIPTS / "3_generate_report.py",  "c3")

sid, dt = "STU_001", "2026-07-06"
stu = str(BASE / "student_responses/class_1/phrase_1/STU_001_phrase1.json")
syl = str(BASE / "syllabus/class_1/class_1_syllabus_phrase1.json")

print("=== STEP 1: Compare Answers ===")
r1 = comp.AnswerComparator().compare(stu)
cf = str(BASE / f"evaluation_reports/{sid}_comparison_{dt}.json")
with open(cf, 'w') as f: json.dump(r1, f, indent=2)

print("\n=== STEP 2: Evaluate Child (API 1/2) ===")
e2 = ev.ChildEvaluator(model="llama-3.1-8b-instant")
r2 = e2.evaluate(cf, syl)
if r2 is None:
    print("Evaluation failed. Check API key/internet.")
    sys.exit(1)

print("\n--- 2 min break before next API call ---")
time.sleep(120)

print("\n=== STEP 3: Generate Report (API 2/2) ===")
ef = str(BASE / f"evaluation_reports/{sid}_evaluation_{dt}.json")
rep.ReportGenerator().generate(ef, r2.get("student_name", "Aditya"))

print("\nPipeline complete! Check evaluation_reports/")
