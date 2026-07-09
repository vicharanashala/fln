"""
Personalized Evaluation Pipeline

Checks existing evaluation reports for a student's class/phrase exam.
If the child failed, generates a personalized next-phrase exam:

  1. Reuses the EXACT same questions the child got wrong
  2. PLUS questions for NEW subtopics/levels present in the target
     phrase's syllabus but NOT in the current phrase's syllabus
  3. If syllabi are identical (e.g. class_1 phrase_3 -> class_2 phrase_1),
     only the failed questions are included
"""

import json
import sys
from pathlib import Path
from datetime import datetime

BASE = Path(__file__).resolve().parent


def determine_next_phrase(class_num, phrase):
    c, p = int(class_num), phrase
    if p == "phrase_1":
        return c, "phrase_2"
    elif p == "phrase_2":
        return c, "phrase_3"
    elif p == "phrase_3":
        return c + 1, "phrase_1"
    return c, p


def load_question_bank(class_num, phrase):
    path = BASE / "questions" / f"class_{class_num}" / phrase / f"class_{class_num}_exam_{phrase}.json"
    if not path.exists():
        return None
    with open(path) as f:
        return json.load(f)


def load_syllabus(class_num, phrase):
    pnum = phrase.replace("phrase_", "")
    path = BASE / "syllabus" / f"class_{class_num}" / f"class_{class_num}_syllabus_phrase{pnum}.json"
    if not path.exists():
        return None
    with open(path) as f:
        return json.load(f)


def get_subtopic_names(syllabus):
    """Return set of subtopic_names from a syllabus."""
    names = set()
    for topic in syllabus.get("topics", []):
        for st in topic.get("subtopics", []):
            name = st.get("subtopic_name", "")
            if name:
                names.add(name)
    return names


def find_evaluation(student_id, class_num, phrase):
    eval_dir = BASE / "evaluation_reports" / f"class_{class_num}" / phrase / "evaluation"
    if not eval_dir.exists():
        return None
    for fpath in sorted(eval_dir.iterdir()):
        if fpath.name.startswith(student_id) and fpath.suffix == ".json":
            with open(fpath) as f:
                return json.load(f)
    return None


def find_comparison(student_id, class_num, phrase):
    comp_dir = BASE / "evaluation_reports" / f"class_{class_num}" / phrase / "comparison"
    if not comp_dir.exists():
        return None
    for fpath in sorted(comp_dir.iterdir()):
        if fpath.name.startswith(student_id) and fpath.suffix == ".json":
            with open(fpath) as f:
                return json.load(f)
    return None


def find_student_response(student_id, class_num, phrase):
    """Look for the original student response file."""
    resp_dir = BASE / "student_responses" / f"class_{class_num}" / phrase
    if resp_dir.exists():
        for fpath in resp_dir.iterdir():
            if fpath.name.startswith(student_id) and fpath.suffix == ".json":
                with open(fpath) as f:
                    return json.load(f)
    # fallback: flat student_responses
    for fpath in sorted((BASE / "student_responses").iterdir()):
        if fpath.name.startswith(student_id) and fpath.suffix == ".json":
            with open(fpath) as f:
                data = json.load(f)
            if data.get("enrolled_class") == class_num:
                return data
    return None


def get_failed_questions(comparison, full_question_bank):
    """Return the exact question objects the child got wrong."""
    failed = []
    qid_to_question = {q["question_id"]: q for q in full_question_bank.get("questions", [])}
    for c in comparison.get("comparisons", []):
        if c.get("status") == "\u2717":
            qid = c["question_id"]
            if qid in qid_to_question:
                failed.append(qid_to_question[qid])
    return failed


def get_questions_for_subtopic_names(question_bank, subtopic_names):
    """Return questions whose subtopic name matches one of the given names."""
    matched = []
    seen = set()
    for q in question_bank.get("questions", []):
        qid = q.get("question_id")
        if qid in seen:
            continue
        q_st = q.get("subtopic", "")
        q_topic = q.get("topic", "")
        if q_st in subtopic_names or q_topic in subtopic_names:
            matched.append(q)
            seen.add(qid)
    return matched


def run_pipeline(student_id, class_num, phrase, student_name=None):
    print("=" * 70)
    print(f"PERSONALIZED EVALUATION PIPELINE")
    print(f"Student: {student_id} | Class {class_num} | {phrase}")
    print("=" * 70)

    # --- Load existing reports ---
    print("\n--- Checking Existing Evaluation Reports ---")
    evaluation = find_evaluation(student_id, class_num, phrase)
    comparison = find_comparison(student_id, class_num, phrase)

    if evaluation is None and comparison is None:
        print(f"  [ERROR] No evaluation or comparison found for {student_id} / class_{class_num} / {phrase}")
        return

    fln_status = "fail"
    decision = "EVALUATE"
    if evaluation:
        fln_status = evaluation.get("fln_status", "fail")
        decision = evaluation.get("decision", "EVALUATE")
        print(f"  Evaluation: {evaluation.get('demonstrated_level', 'N/A')}")
        print(f"  Decision: {decision}  |  FLN Status: {fln_status}")
    else:
        print(f"  Only comparison data available (no evaluation).")

    is_pass = (fln_status == "pass" or decision == "PASS")
    if is_pass:
        print("\n" + "=" * 70)
        print(f"RESULT: {student_id} PASSED {phrase}! No personalized exam needed.")
        print("=" * 70)
        return

    # --- Load current question bank ---
    current_qbank = load_question_bank(class_num, phrase)
    if current_qbank is None:
        print(f"  [ERROR] Current question bank not found: class_{class_num}/{phrase}")
        return

    # --- Get exact failed questions ---
    if comparison is None:
        print("  [ERROR] Comparison data required to identify failed questions.")
        return

    failed_questions = get_failed_questions(comparison, current_qbank)
    print(f"\n  Failed questions: {len(failed_questions)}")

    # --- Determine target phrase ---
    target_class, target_phrase = determine_next_phrase(class_num, phrase)
    print(f"\n  Target: Class {target_class} / {target_phrase}")

    # --- Build personalized exam ---
    all_questions = list(failed_questions)
    seen_qids = {q["question_id"] for q in all_questions}

    # Add questions for new levels only when staying in the same class
    # (phrase_1->2 adds 4 new levels; phrase_2->3 adds all remaining levels)
    # When moving to next class (phrase_3->next_class phrase_1), just reuse
    add_new_levels = (target_class == class_num)
    new_qs = []

    if add_new_levels:
        current_syllabus = load_syllabus(class_num, phrase)
        target_syllabus = load_syllabus(target_class, target_phrase)

        current_names = get_subtopic_names(current_syllabus) if current_syllabus else set()
        target_names = get_subtopic_names(target_syllabus) if target_syllabus else set()
        new_names = target_names - current_names

        print(f"  Current syllabus subtopics: {len(current_names)}")
        print(f"  Target syllabus subtopics:  {len(target_names)}")
        print(f"  New subtopics in target:     {len(new_names)}")

        if new_names:
            target_qbank = load_question_bank(target_class, target_phrase)
            if target_qbank:
                new_qs = get_questions_for_subtopic_names(target_qbank, new_names)
                for q in new_qs:
                    if q["question_id"] not in seen_qids:
                        all_questions.append(q)
                        seen_qids.add(q["question_id"])
    else:
        print(f"  Same class progression (no new levels to add).")
    print(f"  Additional questions for new levels: {len(new_qs)}")

    if not all_questions:
        print("  [WARN] No questions selected. Using all from target exam as fallback.")
        target_qbank = load_question_bank(target_class, target_phrase)
        if target_qbank:
            all_questions = target_qbank.get("questions", [])
            seen_qids = {q["question_id"] for q in all_questions}

    # --- Build exam JSON ---
    exam_id = f"PERSONALIZED_{current_qbank.get('exam_id', 'EXAM')}_{student_id}"
    target_exam_id = f"class_{target_class}_exam_{target_phrase}"
    personalized_exam = {
        "exam_id": exam_id,
        "class": target_class,
        "phrase": target_phrase,
        "is_personalized": True,
        "original_student_id": student_id,
        "original_exam": current_qbank.get("exam_id", ""),
        "original_phrase": phrase,
        "generated_date": datetime.now().strftime("%Y-%m-%d"),
        "total_questions": len(all_questions),
        "questions": all_questions
    }

    # --- Save ---
    stu_name = student_name or (evaluation.get("student_name", student_id) if evaluation else student_id)
    pe_dir = BASE / "personalized_evaluation" / f"class_{class_num}" / student_id / f"class_{target_class}_{target_phrase}"
    pe_dir.mkdir(parents=True, exist_ok=True)

    exam_file = pe_dir / f"{student_id}_{target_phrase}_personalized_exam.json"
    with open(exam_file, 'w') as f:
        json.dump(personalized_exam, f, indent=2)
    print(f"\n  Personalized exam saved: {exam_file}")

    # --- Student response template ---
    resp_answers = {}
    for q in all_questions:
        resp_answers[q["question_id"]] = {"answer": "", "confidence": 0.0}
    response_template = {
        "student_id": student_id,
        "student_name": stu_name,
        "enrolled_class": target_class,
        "test_date": datetime.now().strftime("%Y-%m-%d"),
        "phrase": target_phrase,
        "exam_id": exam_id,
        "answers": resp_answers
    }
    response_file = pe_dir / f"{student_id}_{target_phrase}_response_template.json"
    with open(response_file, 'w') as f:
        json.dump(response_template, f, indent=2)
    print(f"  Response template saved: {response_file}")

    print("\n" + "=" * 70)
    print(f"PIPELINE COMPLETE for {student_id}")
    print(f"  Personalized Class {target_class} {target_phrase} exam ready at:")
    print(f"  personalized_evaluation/class_{class_num}/{student_id}/class_{target_class}_{target_phrase}/")
    print(f"  Failed Qs reused: {len(failed_questions)}  |  New-level Qs added: {len(all_questions) - len(failed_questions)}")
    print("=" * 70)

    return {
        "student_id": student_id,
        "class": class_num,
        "phrase": phrase,
        "fln_status": fln_status,
        "target_class": target_class,
        "target_phrase": target_phrase,
        "failed_questions_reused": len(failed_questions),
        "new_level_questions_added": len(all_questions) - len(failed_questions),
        "personalized_exam": str(exam_file),
        "response_template": str(response_file)
    }


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python personalized_evaluation_pipeline.py <student_id> <class_num> [phrase]")
        print("Example: python personalized_evaluation_pipeline.py STU_C1P3_001 1 phrase_3")
        print("Example: python personalized_evaluation_pipeline.py STU_C2P2_001 2 phrase_2")
        sys.exit(1)

    student_id = sys.argv[1]
    class_num = int(sys.argv[2])
    phrase = sys.argv[3] if len(sys.argv) > 3 else "phrase_1"

    run_pipeline(student_id, class_num, phrase)
