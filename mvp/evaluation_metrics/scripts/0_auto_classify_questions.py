import json
import os
import shutil
import time
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent.parent

from _api import groq_api_call

class QuestionClassifier:
    def __init__(self, model="llama-3.1-8b-instant", api_key=None):
        self.model = model
        self.api_key = api_key
        self.prompt = self._load_prompt()
        self.stats = {"processed": 0, "success": 0, "failed": 0}

    def _load_prompt(self):
        with open(BASE_DIR / "prompts/classify_question.txt") as f:
            return f.read()

    def classify(self, question_text):
        prompt = self.prompt.replace("{question}", question_text)

        result = groq_api_call(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a Math FLN curriculum classifier. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=500,
            timeout=30,
            api_key=self.api_key,
            max_retries=5
        )

        if result is None:
            print("  API call failed after retries")
            return None

        try:
            output = result["choices"][0]["message"]["content"].strip()
            if output.startswith("```"):
                output = output.split("```")[1]
                if output.startswith("json"):
                    output = output[4:]
                output = output.strip()

            classification = json.loads(output)
            if not isinstance(classification, dict):
                return None

            time.sleep(2)
            return classification
        except Exception as e:
            print(f"  Error parsing response: {e}")
            return None

    def process_all(self, questions_dir="questions"):
        print("\n" + "="*60)
        print("QUESTION AUTO-CLASSIFICATION PIPELINE")
        print("="*60)

        questions_path = BASE_DIR / questions_dir
        for class_folder in sorted(questions_path.iterdir()):
            if not class_folder.is_dir():
                continue

            print(f"\n{class_folder.name.upper()}:")

            for q_file in sorted(class_folder.glob("question_*.json")):
                with open(q_file) as f:
                    question = json.load(f)

                if "topic" in question:
                    print(f"  \u2713 {q_file.name} (already classified)")
                    self.stats["success"] += 1
                    self.stats["processed"] += 1
                    continue

                print(f"  \u23f3 {q_file.name}...", end="", flush=True)
                classification = self.classify(question["question"])

                if classification:
                    question.update(classification)
                    question["classification_metadata"] = {
                        "auto_classified": True,
                        "model": self.model,
                        "date": datetime.now().isoformat()
                    }
                    shutil.copy2(q_file, q_file.with_suffix('.json.bak'))
                    with open(q_file, 'w') as f:
                        json.dump(question, f, indent=2)
                    print(" \u2713")
                    self.stats["success"] += 1
                else:
                    print(" \u2717")
                    self.stats["failed"] += 1

                self.stats["processed"] += 1

            for exam_file in sorted(class_folder.glob("*_exam.json")):
                print(f"  \u23f3 {exam_file.name}...")

                with open(exam_file) as f:
                    exam = json.load(f)

                for question in exam["questions"]:
                    if "topic" in question:
                        print(f"    \u2713 {question['question_id']} (already classified)")
                        self.stats["success"] += 1
                        self.stats["processed"] += 1
                        continue

                    print(f"    \u23f3 {question['question_id']}...", end="", flush=True)
                    classification = self.classify(question["question"])

                    if classification:
                        question.update(classification)
                        print(" \u2713")
                        self.stats["success"] += 1
                    else:
                        print(" \u2717")
                        self.stats["failed"] += 1

                    self.stats["processed"] += 1

                shutil.copy2(exam_file, exam_file.with_suffix('.json.bak'))
                with open(exam_file, 'w') as f:
                    json.dump(exam, f, indent=2)
                print(f"  \u2713 {exam_file.name} updated")

        print("\n" + "="*60)
        print(f"SUMMARY:")
        print(f"  Processed: {self.stats['processed']}")
        print(f"  Success: {self.stats['success']}")
        print(f"  Failed: {self.stats['failed']}")
        print("="*60 + "\n")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] in ("-h", "--help"):
        print("Usage: python scripts/0_auto_classify_questions.py [questions_dir]")
        print("Classifies questions in the given directory (default: questions/)")
        print("Example: python scripts/0_auto_classify_questions.py")
        print("Example: python scripts/0_auto_classify_questions.py questions/class_2")
        sys.exit(0)

    questions_dir = sys.argv[1] if len(sys.argv) > 1 else "questions"
    classifier = QuestionClassifier(model="llama-3.1-8b-instant")
    classifier.process_all(questions_dir)
