import json, sys, os, time, importlib.util
from pathlib import Path

BASE = Path(__file__).resolve().parent
SCRIPTS = BASE / "scripts"
sys.path.insert(0, str(SCRIPTS))

def load_mod(path, name):
    s = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m

comp = load_mod(SCRIPTS / "1_compare_answers.py", "c1")
ev   = load_mod(SCRIPTS / "2_evaluate_child.py",   "c2")
rep  = load_mod(SCRIPTS / "3_generate_report.py",  "c3")

def usage():
    print("Usage: python run_pipeline.py <class_num> <phrase> <student_id> [model]")
    print("Example: python run_pipeline.py 3 phrase_1 STU_CLASS3_FAIL llama-3.3-70b-versatile")
    sys.exit(1)

if len(sys.argv) < 4:
    usage()

class_num = sys.argv[1]
phrase    = sys.argv[2]
student_id = sys.argv[3]
model = sys.argv[4] if len(sys.argv) > 4 else "llama-3.1-8b-instant"
date_str = time.strftime("%Y-%m-%d")

stu_dir = BASE / "student_responses" / f"class_{class_num}" / phrase
stu_file = stu_dir / f"{student_id}.json"
if not stu_file.exists():
    print(f"Student response not found: {stu_file}")
    sys.exit(1)

stu_data = json.loads(stu_file.read_text())
student_name = stu_data.get("student_name", student_id)

rep_dir = BASE / "evaluation_reports" / f"class_{class_num}" / phrase
rep_dir / "comparison"
rep_dir / "evaluation"
rep_dir / "reports"
for d in ["comparison", "evaluation", "reports"]:
    (rep_dir / d).mkdir(parents=True, exist_ok=True)

comparison_file = str(rep_dir / "comparison" / f"{student_id}_comparison_{date_str}.json")
evaluation_file = str(rep_dir / "evaluation" / f"{student_id}_evaluation_{date_str}.json")
report_file     = str(rep_dir / "reports" / f"{student_id}_report_{date_str}.txt")
phrase_num = phrase.replace("phrase_", "")
syllabus_file   = str(BASE / "syllabus" / f"class_{class_num}" / f"class_{class_num}_syllabus_phrase{phrase_num}.json")

print("=" * 60)
print(f"PIPELINE: class_{class_num}/{phrase} / {student_id}")
print(f"Model: {model}")
print("=" * 60)

print("\n=== STEP 1: Compare Answers ===")
r1 = comp.AnswerComparator(auto_save=False).compare(str(stu_file))
with open(comparison_file, 'w') as f:
    json.dump(r1, f, indent=2)
print(f"  -> {comparison_file}")

print("\n=== STEP 2: Evaluate Child (API) ===")
evaluator = ev.ChildEvaluator(model=model, auto_save=False)
r2 = None
for step_retry in range(3):
    r2 = evaluator.evaluate(comparison_file, syllabus_file)
    if r2 is not None:
        break
    print(f"  Evaluation attempt {step_retry + 1}/3 failed, retrying in 10s...")
    time.sleep(10)

if r2 is None:
    print("Evaluation failed after 3 attempts. Check API key/internet.")
    sys.exit(1)

with open(evaluation_file, 'w') as f:
    json.dump(r2, f, indent=2)
print(f"  -> {evaluation_file}")

# Removed delay for real-time web server integration
pass

print("\n=== STEP 3: Generate Report (API) ===")
generator = rep.ReportGenerator(model=model)
def custom_save(eval_data, sn):
    with open(report_file, 'w') as f:
        f.write(generator.report)
    print(f"  -> {report_file}")
generator._save_report = custom_save
generator.generate(evaluation_file, student_name)

print("\nPipeline complete!")
