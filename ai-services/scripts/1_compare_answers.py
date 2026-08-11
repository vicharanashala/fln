import json
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent.parent

class AnswerComparator:
    def __init__(self, auto_save=True):
        self.result = None
        self.questions_db = {}
        self.auto_save = auto_save

    def _load_questions_db(self, class_num=None):
        if class_num:
            class_folder = BASE_DIR / "questions" / f"class_{class_num}"
            if class_folder.exists():
                for q_file in class_folder.rglob("question_*.json"):
                    with open(q_file) as f:
                        q = json.load(f)
                        self.questions_db[q["question_id"]] = q
                for exam_file in class_folder.rglob("*_exam_*.json"):
                    with open(exam_file) as f:
                        exam = json.load(f)
                        for q in exam["questions"]:
                            self.questions_db[q["question_id"]] = q
        else:
            for class_folder in (BASE_DIR / "questions").iterdir():
                if not class_folder.is_dir():
                    continue
                for q_file in class_folder.rglob("question_*.json"):
                    with open(q_file) as f:
                        q = json.load(f)
                        self.questions_db[q["question_id"]] = q
                for exam_file in class_folder.rglob("*_exam_*.json"):
                    with open(exam_file) as f:
                        exam = json.load(f)
                        for q in exam["questions"]:
                            self.questions_db[q["question_id"]] = q

    def compare(self, student_response_file):
        print("\n" + "="*60)
        print("ANSWER COMPARISON PIPELINE")
        print("="*60)

        with open(student_response_file) as f:
            student_data = json.load(f)

        enrolled_class = student_data["enrolled_class"]

        self._load_questions_db(class_num=enrolled_class)
        answers = student_data["answers"]

        print(f"\nStudent: {student_data.get('student_id')}")
        print(f"Enrolled Class: {enrolled_class}")
        print(f"Total Questions: {len(answers)}\n")

        self.result = {
            "student_id": student_data["student_id"],
            "student_name": student_data.get("student_name", "Unknown"),
            "test_date": student_data["test_date"],
            "enrolled_class": enrolled_class,
            "comparisons": [],
            "stats": {
                "total": 0,
                "correct": 0,
                "wrong": 0,
                "wrong_percentage": 0
            },
            "wrong_by_difficulty": {
                "easy": [],
                "medium": [],
                "hard": [],
                "unknown": []
            }
        }

        for q_id, student_ans in answers.items():
            if q_id not in self.questions_db:
                print(f"  [!] Question not found: {q_id}")
                continue

            question = self.questions_db[q_id]
            is_correct = str(student_ans["answer"]).strip() == str(question["answer"]).strip()

            diff_map = {"e": "easy", "m": "medium", "h": "hard"}
            comparison = {
                "question_id": q_id,
                "class": question.get("class_level"),
                "topic": question.get("topic"),
                "subtopic": question.get("subtopic"),
                "difficulty": diff_map.get(question.get("difficulty", "unclassified"), question.get("difficulty", "unclassified")),
                "student_answer": student_ans["answer"],
                "correct_answer": question["answer"],
                "status": "\u2713" if is_correct else "\u2717",
                "ocr_confidence": student_ans.get("confidence", 0.9)
            }

            self.result["comparisons"].append(comparison)

            if not is_correct:
                difficulty = {"e": "easy", "m": "medium", "h": "hard"}.get(question.get("difficulty", "unknown"), question.get("difficulty", "unknown"))
                if difficulty not in self.result["wrong_by_difficulty"]:
                    self.result["wrong_by_difficulty"][difficulty] = []
                self.result["wrong_by_difficulty"][difficulty].append(comparison)

            self.result["stats"]["total"] += 1
            if is_correct:
                self.result["stats"]["correct"] += 1
            else:
                self.result["stats"]["wrong"] += 1

        if self.result["stats"]["total"] > 0:
            wrong_pct = (self.result["stats"]["wrong"] / self.result["stats"]["total"]) * 100
            self.result["stats"]["wrong_percentage"] = round(wrong_pct, 2)

        self.result["decision"] = self._determine_decision()

        self._print_summary()
        if self.auto_save:
            self._save_comparison()

        return self.result

    def _determine_decision(self):
        wrong_pct = self.result["stats"]["wrong_percentage"]
        wrong_easy = len(self.result["wrong_by_difficulty"]["easy"])
        wrong_medium = len(self.result["wrong_by_difficulty"]["medium"])
        wrong_hard = len(self.result["wrong_by_difficulty"]["hard"])

        if wrong_pct <= 10:
            if wrong_easy > 0 and (wrong_medium == 0 and wrong_hard == 0):
                return "RETEST"
            elif wrong_hard > 0 and wrong_easy == 0:
                return "PLACE_AT_LEVEL"
            elif wrong_pct == 0:
                return "PLACE_AT_LEVEL"
            else:
                return "EVALUATE"
        else:
            return "EVALUATE"

    def _print_summary(self):
        stats = self.result["stats"]

        print(f"Results:")
        print(f"  [OK] Correct: {stats['correct']}/{stats['total']}")
        print(f"  [X] Wrong: {stats['wrong']}/{stats['total']}")
        print(f"  [!] Wrong %: {stats['wrong_percentage']}%")
        print(f"\nWrong by Difficulty:")
        print(f"  Easy: {len(self.result['wrong_by_difficulty']['easy'])}")
        print(f"  Medium: {len(self.result['wrong_by_difficulty']['medium'])}")
        print(f"  Hard: {len(self.result['wrong_by_difficulty']['hard'])}")
        print(f"  Unknown: {len(self.result['wrong_by_difficulty']['unknown'])}")
        print(f"\nDecision: {self.result['decision']}")

    def _save_comparison(self):
        output_file = BASE_DIR / f"evaluation_reports/{self.result['student_id']}_comparison_{self.result['test_date']}.json"
        output_file.parent.mkdir(exist_ok=True)

        with open(output_file, 'w') as f:
            json.dump(self.result, f, indent=2)

        print(f"\n[OK] Comparison saved: {output_file}")
        print("="*60 + "\n")


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python scripts/1_compare_answers.py <student_response_file>")
        print("Example: python scripts/1_compare_answers.py student_responses/STU_001_class1_2025-01-15.json")
        sys.exit(1)

    comparator = AnswerComparator()
    comparator.compare(sys.argv[1])
