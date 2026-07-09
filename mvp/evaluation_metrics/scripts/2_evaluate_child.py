import json
import os
from pathlib import Path
from datetime import datetime, timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

from _api import groq_api_call

class ChildEvaluator:
    def __init__(self, model="llama-3.1-8b-instant", api_key=None, auto_save=True):
        self.model = model
        self.api_key = api_key
        self.prompt = self._load_prompt()
        self.result = None
        self.auto_save = auto_save

    def _load_prompt(self):
        try:
            with open(BASE_DIR / "prompts/evaluate_child.txt") as f:
                return f.read()
        except:
            return ""

    def evaluate(self, comparison_file, syllabus_file):
        print("\n" + "="*60)
        print("CHILD EVALUATION PIPELINE")
        print("="*60)

        with open(comparison_file) as f:
            comparison = json.load(f)

        with open(syllabus_file) as f:
            syllabus = json.load(f)

        print(f"\nStudent: {comparison['student_id']}")
        print(f"Enrolled Class: {comparison['enrolled_class']}")
        print(f"Wrong %: {comparison['stats']['wrong_percentage']}%")
        print(f"Decision: {comparison.get('decision', 'EVALUATE')}\n")

        if comparison.get('decision') == 'RETEST':
            print("[OK] Decision: RETEST (careless mistakes in easy section)")
            self.result = {
                "student_id": comparison['student_id'],
                "test_date": comparison['test_date'],
                "decision": "RETEST",
                "reason": "Wrong answers < 10% and only in easy section (careless mistakes)",
                "retest_date": (datetime.now() + timedelta(days=7)).isoformat(),
                "recommendation": "Retest with same exam in 1 week",
                "demonstrated_level": comparison.get('enrolled_class'),
                "confidence_score": 0.95
            }
            self._save_evaluation()
            return self.result

        wrong_answers = [c for c in comparison["comparisons"] if c["status"] == "\u2717"]

        all_comparisons = comparison["comparisons"]
        perf_by_diff = {}
        diff_map = {"e": "easy", "m": "medium", "h": "hard"}
        for c in all_comparisons:
            d = c.get("difficulty", "unknown") or "unclassified"
            d = diff_map.get(d, d)
            if d not in perf_by_diff:
                perf_by_diff[d] = {"attempted": 0, "correct": 0}
            perf_by_diff[d]["attempted"] += 1
            if c["status"] == "\u2713":
                perf_by_diff[d]["correct"] += 1

        enrolled = int(comparison.get('enrolled_class', 1))
        easy_pct = (perf_by_diff.get("easy", {}).get("correct", 0) / max(perf_by_diff.get("easy", {}).get("attempted", 1), 1)) * 100
        medium_pct = (perf_by_diff.get("medium", {}).get("correct", 0) / max(perf_by_diff.get("medium", {}).get("attempted", 1), 1)) * 100
        hard_pct = (perf_by_diff.get("hard", {}).get("correct", 0) / max(perf_by_diff.get("hard", {}).get("attempted", 1), 1)) * 100

        if easy_pct >= 90 and medium_pct >= 50 and hard_pct >= 40:
            print("[OK] FLN PASS - meets all thresholds (easy >= 90%, medium >= 50%, hard >= 40%)")
            self.result = {
                "student_id": comparison['student_id'],
                "student_name": comparison.get('student_name', 'Unknown'),
                "test_date": comparison['test_date'],
                "enrolled_class": comparison['enrolled_class'],
                "decision": "PASS",
                "fln_status": "pass",
                "demonstrated_level": f"Class {enrolled}",
                "boundary_level": f"Class {enrolled + 1}",
                "confidence_score": 0.95,
                "wrong_count": len(wrong_answers),
                "total_questions": len(comparison['comparisons']),
                "wrong_percentage": comparison['stats']['wrong_percentage'],
                "performance_by_difficulty": perf_by_diff,
                "reason": f"Easy: {easy_pct:.0f}% (need >=90%), Medium: {medium_pct:.0f}% (need >=50%), Hard: {hard_pct:.0f}% (need >=40%) - all thresholds met",
                "recommendation": f"Child has mastered foundational concepts for Class {enrolled}. Ready to continue with Class {enrolled} curriculum.",
                "next_level_assignment": f"Class {enrolled}"
            }
            self._save_evaluation()
            return self.result

        print(f"  Easy: {easy_pct:.0f}% (need >=90%), Medium: {medium_pct:.0f}% (need >=50%), Hard: {hard_pct:.0f}% (need >=40%)")
        print("[*] Calling AI model for evaluation...\n")
        wrong_percentage = comparison['stats']['wrong_percentage']

        stripped_wrong = []
        for w in wrong_answers:
            sa = w.get("student_answer", "")
            ca = w.get("correct_answer", "")
            if isinstance(sa, (list, dict)):
                sa = str(type(sa).__name__)
            if isinstance(ca, (list, dict)):
                ca = str(type(ca).__name__)
            stripped_wrong.append({
                "question_id": w["question_id"],
                "topic": w.get("topic", ""),
                "subtopic": w.get("subtopic", ""),
                "difficulty": w.get("difficulty", ""),
                "student_answer": sa,
                "correct_answer": ca
            })

        if len(stripped_wrong) > 12:
            orig_count = len(stripped_wrong)
            stripped_wrong = stripped_wrong[:12]
            print(f"  Truncated wrong answers for API: {orig_count} -> 12 (TPM limit)")

        input_data = {
            "student_id": comparison['student_id'],
            "enrolled_class": comparison['enrolled_class'],
            "test_date": comparison['test_date'],
            "wrong_percentage": wrong_percentage,
            "wrong_answers": stripped_wrong,
            "performance_by_difficulty": perf_by_diff
        }

        with open(syllabus_file) as f:
            syllabus_data = json.load(f)

        syllabus_summary = {
            "class": syllabus_data.get("class", ""),
            "topics": []
        }
        for t in syllabus_data.get("topics", []):
            syllabus_summary["topics"].append({
                "topic": t.get("topic", ""),
                "subtopics": [s.get("subtopic_name", "") for s in t.get("subtopics", [])]
            })

        prompt = self.prompt.replace("{input_data}", json.dumps(input_data, indent=2))
        prompt = prompt.replace("{syllabus_data}", json.dumps(syllabus_summary, indent=2))

        result = groq_api_call(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are an FLN assessment expert. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=800,
            timeout=300,
            api_key=self.api_key,
            max_retries=5
        )

        if result is None:
            print(f"[!] API call failed or key is missing. Using deterministic fallback evaluation.")
            failed_levels = []
            for w in wrong_answers:
                q_class = w.get("class", comparison.get("enrolled_class", 1))
                if q_class:
                    try:
                        failed_levels.append(int(q_class))
                    except:
                        pass
            
            if failed_levels:
                demonstrated_level = min(failed_levels)
            else:
                demonstrated_level = int(comparison.get("enrolled_class", 1))
            
            ai_eval = {
                "root_causes": [{"error_type": "conceptual", "analysis": "student has gaps in foundational topics"}],
                "topics_to_focus": list(set([w.get("topic", "Arithmetic") for w in wrong_answers if w.get("topic")])),
                "prerequisites_to_check": [],
                "recommendation": "Focused practice and worksheet drills on weak topics.",
                "next_level_assignment": f"Class {demonstrated_level}",
                "assigned_level": demonstrated_level,
                "confidence_score": 0.8,
                "levels_failed": list(set(failed_levels)),
                "assign_reason": "Deterministic fallback based on wrong answers"
            }
        else:
            output = result["choices"][0]["message"]["content"].strip()

            print(f"[AI] Raw AI Output:\n{output}\n")

            if output.startswith("```"):
                output = output.split("```")[1]
                if output.startswith("json"):
                    output = output[4:]
                output = output.strip()

            try:
                ai_eval = json.loads(output)
            except json.JSONDecodeError as e:
                print(f"[X] Failed to parse AI output as JSON: {e}")
                print(f"Raw output: {output[:500]}")
                return None
            print(f"Raw output: {output[:500]}")
            return None

        root_causes = ai_eval.get("root_causes", [])
        if root_causes:
            error_type = root_causes[0].get("error_type", "careless")
            root_cause_text = root_causes[0].get("analysis", "gaps in understanding")
        else:
            error_type = "careless"
            root_cause_text = "gaps in understanding"

        topics = ai_eval.get("topics_to_focus", ["core concepts"])
        prerequisites = ai_eval.get("prerequisites_to_check", [])
        ai_recommendation = ai_eval.get("recommendation", "practice and reinforcement")
        ai_next_level = ai_eval.get("next_level_assignment", "")
        if not ai_next_level or "Class X" in ai_next_level:
            ai_next_level = ""

        ai_assigned_level = ai_eval.get("assigned_level")
        ai_levels_failed = ai_eval.get("levels_failed", [])
        ai_assign_reason = ai_eval.get("assign_reason", "")

        if ai_assigned_level is not None:
            demonstrated_level = ai_assigned_level
            boundary_level = ai_assigned_level + 1
            confidence = max(0.60, ai_eval.get("confidence_score", 0.6)) if isinstance(ai_eval.get("confidence_score"), (int, float)) else 0.60
            next_level = ai_assigned_level + 1
        elif wrong_percentage < 10:
            demonstrated_level = comparison['enrolled_class']
            boundary_level = comparison['enrolled_class']
            confidence = 0.95
            next_level = int(comparison['enrolled_class']) + 1
        elif wrong_percentage < 25:
            demonstrated_level = comparison['enrolled_class']
            boundary_level = comparison['enrolled_class']
            confidence = 0.75
            next_level = comparison['enrolled_class']
        else:
            demonstrated_level = max(0, int(comparison['enrolled_class']) - 1)
            boundary_level = comparison['enrolled_class']
            confidence = 0.60
            next_level = comparison['enrolled_class']

        evaluation = {
            "demonstrated_level": f"Level {demonstrated_level}",
            "boundary_level": f"Level {boundary_level}",
            "confidence_score": confidence,
            "error_type": error_type,
            "topics_to_focus": topics,
            "root_cause": root_cause_text,
            "root_causes": root_causes,
            "prerequisites_to_check": prerequisites,
            "performance_by_difficulty": perf_by_diff,
            "recommendation": ai_recommendation,
            "next_level_assignment": ai_next_level or f"Level {next_level}",
            "levels_failed": ai_levels_failed,
            "assigned_level": demonstrated_level,
            "assign_reason": ai_assign_reason or "Minimum failure level rule applied"
        }

        evaluation["student_id"] = comparison['student_id']
        evaluation["test_date"] = comparison['test_date']
        evaluation["enrolled_class"] = comparison['enrolled_class']
        evaluation["wrong_count"] = len(wrong_answers)
        evaluation["total_questions"] = len(comparison['comparisons'])
        evaluation["wrong_percentage"] = wrong_percentage

        self.result = evaluation

        self._print_summary()
        self._save_evaluation()

        return evaluation

    def _print_summary(self):
        if not self.result:
            return

        print(f"\n[OK] Evaluation Results:")
        print(f"  Student ID: {self.result.get('student_id')}")
        print(f"  Class Enrolled: {self.result.get('enrolled_class')}")
        print(f"  Wrong %: {self.result.get('wrong_percentage', 0):.1f}%")
        print(f"  Demonstrated Level: {self.result.get('demonstrated_level')}")
        print(f"  Boundary Level: {self.result.get('boundary_level')}")
        print(f"  Confidence Score: {self.result.get('confidence_score', 0)*100:.0f}%")
        print(f"  Error Type: {self.result.get('error_type')}")
        print(f"  Topic to Focus: {', '.join(self.result.get('topics_to_focus', []))}")
        print(f"  Root Causes Analyzed: {len(self.result.get('root_causes', []))}")
        print(f"  Root Cause: {self.result.get('root_cause')}")
        print(f"  Recommendation: {self.result.get('recommendation')}")
        print(f"  Next Level: {self.result.get('next_level_assignment')}")

    def _save_evaluation(self):
        if not self.auto_save or not self.result:
            return

        output_dir = BASE_DIR / "evaluation_reports"
        output_dir.mkdir(exist_ok=True)

        output_file = output_dir / f"{self.result['student_id']}_evaluation_{self.result['test_date']}.json"

        with open(output_file, 'w') as f:
            json.dump(self.result, f, indent=2)

        print(f"\n[OK] Evaluation saved: {output_file}")
        print("="*60 + "\n")


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python scripts/2_evaluate_child.py <student_id> <class_num> [phrase]")
        print("Example: python scripts/2_evaluate_child.py STU_001 1 phrase_2")
        sys.exit(1)

    student_id = sys.argv[1]
    class_num = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    phrase = sys.argv[3] if len(sys.argv) > 3 else "phrase_1"

    reports_dir = BASE_DIR / "evaluation_reports"
    comparison_files = list(reports_dir.glob(f"{student_id}_comparison_*.json"))
    comparison_files += list(reports_dir.rglob(f"*/{student_id}_comparison_*.json"))

    if not comparison_files:
        print(f"\u2717 No comparison file found for {student_id}")
        sys.exit(1)

    comparison_file = str(sorted(comparison_files, key=lambda f: f.stat().st_mtime)[-1])
    syllabus_file = str(BASE_DIR / f"syllabus/class_{class_num}/class_{class_num}_syllabus_{phrase.replace('phrase_', '')}.json")

    if not Path(syllabus_file).exists():
        print(f"\u2717 Syllabus file not found: {syllabus_file}")
        print(f"  Tried: {syllabus_file}")
        sys.exit(1)

    evaluator = ChildEvaluator(model="llama-3.1-8b-instant")
    evaluator.evaluate(comparison_file, syllabus_file)
