import sys
sys.path.insert(0, "/home/shreya/fln/evaluation_metrics/scripts")
from pathlib import Path

from compare_answers import AnswerComparator
from evaluate_child import ChildEvaluator
from generate_report import ReportGenerator

BASE = Path("/home/shreya/fln/evaluation_metrics")

student_file = str(BASE / "student_responses/class_2/phrase_2/STU_C2P2_001_phrase2.json")
comparison_out = str(BASE / "evaluation_reports/class_2/phrase_2/comparison/STU_C2P2_001_comparison_2026-07-06.json")
evaluation_out = str(BASE / "evaluation_reports/class_2/phrase_2/evaluation/STU_C2P2_001_evaluation_2026-07-06.json")
report_out = str(BASE / "evaluation_reports/class_2/phrase_2/reports/STU_C2P2_001_report_2026-07-06.txt")
syllabus_file = str(BASE / "syllabus/class_2/class_2_syllabus_phrase2.json")

print("=" * 60)
print("STEP 1: ANSWER COMPARISON")
print("=" * 60)
comparator = AnswerComparator()
result = comparator.compare(student_file)
with open(comparison_out, "w") as f:
    import json
    json.dump(result, f, indent=2)
print(f"  Comparison saved to: {comparison_out}")

print("\n" + "=" * 60)
print("STEP 2: CHILD EVALUATION (API - 2 min delay)")
print("=" * 60)
evaluator = ChildEvaluator(model="llama-3.1-8b-instant")
eval_result = evaluator.evaluate(comparison_out, syllabus_file)
if eval_result:
    with open(evaluation_out, "w") as f:
        json.dump(eval_result, f, indent=2)
    print(f"  Evaluation saved to: {evaluation_out}")

print("\n" + "=" * 60)
print("STEP 3: REPORT GENERATION (API)")
print("=" * 60)
generator = ReportGenerator()
# Override _save_report to output to our path
original_save = generator._save_report
def custom_save(eval_data, student_name):
    with open(report_out, "w") as f:
        f.write(generator.report)
    print(f"\n✓ Report saved: {report_out}")
    print("="*60 + "\n")
generator._save_report = custom_save
generator.generate(evaluation_out, "Ravi Kumar")
