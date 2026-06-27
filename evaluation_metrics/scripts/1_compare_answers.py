<<<<<<< HEAD
=======
# scripts/1_compare_answers.py (FULL UPDATED)

>>>>>>> origin/main
import json
from pathlib import Path
from datetime import datetime

<<<<<<< HEAD
BASE_DIR = Path(__file__).resolve().parent.parent

=======
>>>>>>> origin/main
class AnswerComparator:
    def __init__(self):
        self.result = None
        self.questions_db = {}
<<<<<<< HEAD

    def _load_questions_db(self):
        for class_folder in (BASE_DIR / "questions").iterdir():
            if not class_folder.is_dir():
                continue

=======
    
    def _load_questions_db(self):
        """Load all questions from individual files or exam files"""
        for class_folder in Path("questions").iterdir():
            if not class_folder.is_dir():
                continue
            
            # Load individual question files
>>>>>>> origin/main
            for q_file in class_folder.glob("question_*.json"):
                with open(q_file) as f:
                    q = json.load(f)
                    self.questions_db[q["question_id"]] = q
<<<<<<< HEAD

=======
            
            # Load exam files
>>>>>>> origin/main
            for exam_file in class_folder.glob("*_exam.json"):
                with open(exam_file) as f:
                    exam = json.load(f)
                    for q in exam["questions"]:
                        self.questions_db[q["question_id"]] = q
<<<<<<< HEAD

    def compare(self, student_response_file):
        print("\n" + "="*60)
        print("ANSWER COMPARISON PIPELINE")
        print("="*60)

        self._load_questions_db()

        with open(student_response_file) as f:
            student_data = json.load(f)

        enrolled_class = student_data["enrolled_class"]
        answers = student_data["answers"]

        print(f"\nStudent: {student_data.get('student_id')}")
        print(f"Enrolled Class: {enrolled_class}")
        print(f"Total Questions: {len(answers)}\n")

=======
    
    def compare(self, student_response_file):
        """Compare student answers with answer keys"""
        
        print("\n" + "="*60)
        print("ANSWER COMPARISON PIPELINE")
        print("="*60)
        
        # Load questions database
        self._load_questions_db()
        
        with open(student_response_file) as f:
            student_data = json.load(f)
        
        enrolled_class = student_data["enrolled_class"]
        answers = student_data["answers"]
        
        print(f"\nStudent: {student_data.get('student_id')}")
        print(f"Enrolled Class: {enrolled_class}")
        print(f"Total Questions: {len(answers)}\n")
        
>>>>>>> origin/main
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
<<<<<<< HEAD

        for q_id, student_ans in answers.items():
            if q_id not in self.questions_db:
                print(f"  \u26a0\ufe0f  Question not found: {q_id}")
                continue

            question = self.questions_db[q_id]
            is_correct = str(student_ans["answer"]).strip() == str(question["answer"]).strip()

=======
        
        # Compare each answer
        for q_id, student_ans in answers.items():
            if q_id not in self.questions_db:
                print(f"  ⚠️  Question not found: {q_id}")
                continue
            
            question = self.questions_db[q_id]
            is_correct = str(student_ans["answer"]).strip() == str(question["answer"]).strip()
            
>>>>>>> origin/main
            comparison = {
                "question_id": q_id,
                "class": question.get("class_level"),
                "topic": question.get("topic"),
                "subtopic": question.get("subtopic"),
                "difficulty": question.get("difficulty", "unclassified"),
                "student_answer": student_ans["answer"],
                "correct_answer": question["answer"],
<<<<<<< HEAD
                "status": "\u2713" if is_correct else "\u2717",
                "ocr_confidence": student_ans.get("confidence", 0.9)
            }

            self.result["comparisons"].append(comparison)

=======
                "status": "✓" if is_correct else "✗",
                "ocr_confidence": student_ans.get("confidence", 0.9)
            }
            
            self.result["comparisons"].append(comparison)
            
            # Track wrong answers by difficulty
>>>>>>> origin/main
            if not is_correct:
                difficulty = question.get("difficulty", "unknown")
                if difficulty not in self.result["wrong_by_difficulty"]:
                    self.result["wrong_by_difficulty"][difficulty] = []
                self.result["wrong_by_difficulty"][difficulty].append(comparison)
<<<<<<< HEAD

=======
            
>>>>>>> origin/main
            self.result["stats"]["total"] += 1
            if is_correct:
                self.result["stats"]["correct"] += 1
            else:
                self.result["stats"]["wrong"] += 1
<<<<<<< HEAD

        if self.result["stats"]["total"] > 0:
            wrong_pct = (self.result["stats"]["wrong"] / self.result["stats"]["total"]) * 100
            self.result["stats"]["wrong_percentage"] = round(wrong_pct, 2)

        self.result["decision"] = self._determine_decision()

        self._print_summary()
        self._save_comparison()

        return self.result

    def _determine_decision(self):
=======
        
        # Calculate percentage
        if self.result["stats"]["total"] > 0:
            wrong_pct = (self.result["stats"]["wrong"] / self.result["stats"]["total"]) * 100
            self.result["stats"]["wrong_percentage"] = round(wrong_pct, 2)
        
        # Determine decision
        self.result["decision"] = self._determine_decision()
        
        # Print summary
        self._print_summary()
        
        # Save comparison
        self._save_comparison()
        
        return self.result
    
    def _determine_decision(self):
        """Determine next action based on wrong percentage and distribution"""
>>>>>>> origin/main
        wrong_pct = self.result["stats"]["wrong_percentage"]
        wrong_easy = len(self.result["wrong_by_difficulty"]["easy"])
        wrong_medium = len(self.result["wrong_by_difficulty"]["medium"])
        wrong_hard = len(self.result["wrong_by_difficulty"]["hard"])
<<<<<<< HEAD

=======
        
>>>>>>> origin/main
        if wrong_pct < 10:
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
<<<<<<< HEAD

    def _print_summary(self):
        stats = self.result["stats"]

        print(f"Results:")
        print(f"  \u2713 Correct: {stats['correct']}/{stats['total']}")
        print(f"  \u2717 Wrong: {stats['wrong']}/{stats['total']}")
        print(f"  \u26a0\ufe0f  Wrong %: {stats['wrong_percentage']}%")
=======
    
    def _print_summary(self):
        """Print comparison summary"""
        stats = self.result["stats"]
        
        print(f"Results:")
        print(f"  ✓ Correct: {stats['correct']}/{stats['total']}")
        print(f"  ✗ Wrong: {stats['wrong']}/{stats['total']}")
        print(f"  ⚠️  Wrong %: {stats['wrong_percentage']}%")
>>>>>>> origin/main
        print(f"\nWrong by Difficulty:")
        print(f"  Easy: {len(self.result['wrong_by_difficulty']['easy'])}")
        print(f"  Medium: {len(self.result['wrong_by_difficulty']['medium'])}")
        print(f"  Hard: {len(self.result['wrong_by_difficulty']['hard'])}")
        print(f"  Unknown: {len(self.result['wrong_by_difficulty']['unknown'])}")
        print(f"\nDecision: {self.result['decision']}")
<<<<<<< HEAD

    def _save_comparison(self):
        output_file = BASE_DIR / f"evaluation_reports/{self.result['student_id']}_comparison_{self.result['test_date']}.json"
        output_file.parent.mkdir(exist_ok=True)

        with open(output_file, 'w') as f:
            json.dump(self.result, f, indent=2)

        print(f"\n\u2713 Comparison saved: {output_file}")
=======
    
    def _save_comparison(self):
        """Save comparison result to file"""
        output_file = f"evaluation_reports/{self.result['student_id']}_comparison_{self.result['test_date']}.json"
        
        with open(output_file, 'w') as f:
            json.dump(self.result, f, indent=2)
        
        print(f"\n✓ Comparison saved: {output_file}")
>>>>>>> origin/main
        print("="*60 + "\n")


if __name__ == "__main__":
    import sys
<<<<<<< HEAD

=======
    
>>>>>>> origin/main
    if len(sys.argv) < 2:
        print("Usage: python scripts/1_compare_answers.py <student_response_file>")
        print("Example: python scripts/1_compare_answers.py student_responses/STU_001_class1_2025-01-15.json")
        sys.exit(1)
<<<<<<< HEAD

    comparator = AnswerComparator()
    comparator.compare(sys.argv[1])
=======
    
    comparator = AnswerComparator()
    comparator.compare(sys.argv[1])
>>>>>>> origin/main
