import json
import os
import requests
import re
from pathlib import Path
from datetime import datetime, timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

def _load_env():
    env_file = BASE_DIR / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

_load_env()

class ChildEvaluator:
    def __init__(self, model="llama-3.1-8b-instant", api_key=None):
        self.model = model
        self.api_key = api_key or os.environ.get("GROQ_API_KEY", "")
        self.prompt = self._load_prompt()
        self.result = None

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
            print("\u2713 Decision: RETEST (careless mistakes in easy section)")
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

        print("\u23f3 Calling AI model for evaluation...\n")

        wrong_answers = [c for c in comparison["comparisons"] if c["status"] == "\u2717"]
        wrong_percentage = comparison['stats']['wrong_percentage']

        input_data = {
            "student_id": comparison['student_id'],
            "enrolled_class": comparison['enrolled_class'],
            "test_date": comparison['test_date'],
            "wrong_percentage": wrong_percentage,
            "wrong_answers": wrong_answers[:5]
        }

        with open(syllabus_file) as f:
            syllabus_data = json.load(f)

        prompt = self.prompt.replace("{input_data}", json.dumps(input_data, indent=2))
        prompt = prompt.replace("{syllabus_data}", json.dumps(syllabus_data, indent=2))

        all_comparisons = comparison["comparisons"]
        perf_by_diff = {}
        for c in all_comparisons:
            d = c.get("difficulty", "unknown") or "unclassified"
            if d not in perf_by_diff:
                perf_by_diff[d] = {"attempted": 0, "correct": 0}
            perf_by_diff[d]["attempted"] += 1
            if c["status"] == "\u2713":
                perf_by_diff[d]["correct"] += 1

        try:
            response = requests.post(
                'https://api.groq.com/openai/v1/chat/completions',
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": "You are an FLN assessment expert. Return only valid JSON."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.1,
                    "max_tokens": 1500,
                    "stream": False
                },
                timeout=300
            )

            if response.status_code != 200:
                print(f"\u2717 API Error: {response.status_code}")
                print(f"Response: {response.text}")
                return None

            output = response.json()["choices"][0]["message"]["content"].strip()

            print(f"\U0001f4dd Raw AI Output:\n{output}\n")

            if output.startswith("```"):
                output = output.split("```")[1]
                if output.startswith("json"):
                    output = output[4:]
                output = output.strip()

            ai_eval = json.loads(output)

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

            if wrong_percentage < 10:
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
                demonstrated_level = max(1, int(comparison['enrolled_class']) - 1)
                boundary_level = comparison['enrolled_class']
                confidence = 0.60
                next_level = comparison['enrolled_class']

            evaluation = {
                "demonstrated_level": f"Class {demonstrated_level}",
                "boundary_level": f"Class {boundary_level}",
                "confidence_score": confidence,
                "error_type": error_type,
                "topics_to_focus": topics,
                "root_cause": root_cause_text,
                "root_causes": root_causes,
                "prerequisites_to_check": prerequisites,
                "performance_by_difficulty": perf_by_diff,
                "recommendation": ai_recommendation,
                "next_level_assignment": ai_next_level or f"Class {next_level}"
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

        except requests.exceptions.Timeout:
            print(f"\u2717 API Timeout (>300s)")
            return None
        except requests.exceptions.ConnectionError:
            print(f"\u2717 Cannot connect to Groq API")
            print(f"Check your internet connection")
            return None
        except Exception as e:
            print(f"\u2717 Unexpected Error: {str(e)}")
            print(f"Output: {output if 'output' in locals() else 'No output'}")
            return None

    def _print_summary(self):
        if not self.result:
            return

        print(f"\n\u2713 Evaluation Results:")
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
        if not self.result:
            return

        output_dir = BASE_DIR / "evaluation_reports"
        output_dir.mkdir(exist_ok=True)

        output_file = output_dir / f"{self.result['student_id']}_evaluation_{self.result['test_date']}.json"

        with open(output_file, 'w') as f:
            json.dump(self.result, f, indent=2)

        print(f"\n\u2713 Evaluation saved: {output_file}")
        print("="*60 + "\n")


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python scripts/2_evaluate_child.py <student_id> <class_num>")
        print("Example: python scripts/2_evaluate_child.py STU_001 1")
        sys.exit(1)

    student_id = sys.argv[1]
    class_num = int(sys.argv[2]) if len(sys.argv) > 2 else 1

    reports_dir = BASE_DIR / "evaluation_reports"
    comparison_files = list(reports_dir.glob(f"{student_id}_comparison_*.json"))

    if not comparison_files:
        print(f"\u2717 No comparison file found for {student_id}")
        sys.exit(1)

    comparison_file = str(sorted(comparison_files, key=lambda f: f.stat().st_mtime)[-1])
    syllabus_file = str(BASE_DIR / f"syllabus/class_{class_num}_syllabus.json")

    if not Path(syllabus_file).exists():
        print(f"\u2717 Syllabus file not found: {syllabus_file}")
        sys.exit(1)

    evaluator = ChildEvaluator(model="llama-3.1-8b-instant")
    evaluator.evaluate(comparison_file, syllabus_file)
