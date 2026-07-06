import json
import os

def load_syllabus(path):
    with open(path) as f:
        return json.load(f)

def generate_questions_for_subtopic(syllabus, subtopic):
    sid = subtopic["subtopic_id"]
    name = subtopic["subtopic_name"]
    diff = subtopic["difficulty"]
    source = subtopic["source"]
    desc = subtopic["description"]

    question_bank = {
        "NS_OOC": {
            "question": "Draw a line to match each object. Left: ☆ ☆ ☆. Right: ○ ○ ○. Match one star to one circle.",
            "answer": "matched",
            "answer_type": "text"
        },
        "NS_CLASS": {
            "question": "Circle the objects that are big. (Images: big ball, small ball, big book, small pencil)",
            "answer": "big ball, big book",
            "answer_type": "text"
        },
        "NS_SER": {
            "question": "Arrange these numbers in order from smallest to biggest: 1, 3, 2",
            "answer": "1, 2, 3",
            "answer_type": "text"
        },
        "NS_COUNT": {
            "question": "Count the stars: ☆☆☆ How many stars are there?",
            "answer": 3,
            "answer_type": "numeric"
        },
        "NS_NRS": {
            "question": "Recite the number rhyme 'One, Two, Buckle My Shoe'. Write the numbers 1 to 5.",
            "answer": "1, 2, 3, 4, 5",
            "answer_type": "text"
        },
        "NS_ODD": {
            "question": "Look at the group: Apple, Banana, Chair, Orange. Which one does not belong?",
            "answer": "Chair",
            "answer_type": "text"
        },
        "NS_MATCH": {
            "question": "Match each shape to its name: Left: ○ △ □, Right: Circle Triangle Square",
            "answer": "Circle, Triangle, Square",
            "answer_type": "text"
        },
        "NS_NR": {
            "question": "What number is this? (Picture of number 4) Write the number.",
            "answer": 4,
            "answer_type": "numeric"
        },
        "NS_CQ": {
            "question": "Which group has MORE? Left: ☆☆ (2 stars), Right: ☆☆☆☆☆ (5 stars)",
            "answer": "Right",
            "answer_type": "text"
        },
        "NS_FC": {
            "question": "Count forward: 1, 2, __, 4, 5. What number is missing?",
            "answer": 3,
            "answer_type": "numeric"
        },
        "NS_ZA": {
            "question": "If you have 5 balloons and all fly away, how many balloons are left?",
            "answer": 0,
            "answer_type": "numeric"
        },
        "NS_NN5": {
            "question": "Write the number name for 3.",
            "answer": "three",
            "answer_type": "text"
        },
        "NS_FGC": {
            "question": "Show 3 fingers. How many fingers are you showing?",
            "answer": 3,
            "answer_type": "numeric"
        },
        "NS_ABB": {
            "question": "What number comes AFTER 3 in the sequence: 1, 2, 3, _?",
            "answer": 4,
            "answer_type": "numeric"
        },
        "NS_SERP3": {
            "question": "Arrange these in order of size: (Small ball, Medium ball, Big ball). Write: 1 for smallest, 2 for medium, 3 for biggest.",
            "answer": "1, 2, 3",
            "answer_type": "text"
        },
        "NS_COUNT10": {
            "question": "Count the stars: ☆☆☆☆☆☆☆☆☆☆ How many stars?",
            "answer": 10,
            "answer_type": "numeric"
        },
        "NS_FCUP9": {
            "question": "Write the missing number: 9, 8, 7, _, 5",
            "answer": 6,
            "answer_type": "numeric"
        },
        "NS_NW9": {
            "question": "Write the number 7 in the box.",
            "answer": 7,
            "answer_type": "numeric"
        },
        "NS_NN10": {
            "question": "Write the number name for 7.",
            "answer": "seven",
            "answer_type": "text"
        },
        "NS_COMPNUM": {
            "question": "Which is greater? 6 or 9?",
            "answer": 9,
            "answer_type": "numeric"
        },
        "NS_TENS": {
            "question": "How many tens and ones in 15? (1 bundle of ten + 5 ones)",
            "answer": "1 ten and 5 ones",
            "answer_type": "text"
        },
        "NS_N1130": {
            "question": "Count and write the number: (Picture of 23 objects) How many?",
            "answer": 23,
            "answer_type": "numeric"
        },
        "NS_CNTTRACE": {
            "question": "Count 12 apples. Trace and write the number 12.",
            "answer": 12,
            "answer_type": "numeric"
        },
        "NS_ABB1130": {
            "question": "What number comes AFTER 18? 18, __",
            "answer": 19,
            "answer_type": "numeric"
        },
        "NS_ORD30": {
            "question": "Arrange in ascending order: 25, 12, 30, 18",
            "answer": "12, 18, 25, 30",
            "answer_type": "text"
        },
        "NS_N3150": {
            "question": "Write the number that comes between 34 and 36.",
            "answer": 35,
            "answer_type": "numeric"
        },
        "NS_SKIP": {
            "question": "Fill the missing numbers: 2, 4, __, 8, 10 (skip count by 2s)",
            "answer": 6,
            "answer_type": "numeric"
        },
        "NS_CMP50": {
            "question": "Compare: 34 _ 43. Write >, < or =",
            "answer": "<",
            "answer_type": "text"
        },
        "NS_ORD50": {
            "question": "Arrange in descending order: 45, 23, 38, 50",
            "answer": "50, 45, 38, 23",
            "answer_type": "text"
        },
        "NO_EAA": {
            "question": "If you have 2 apples and your friend gives you 1 more, how many apples do you have now?",
            "answer": 3,
            "answer_type": "numeric"
        },
        "NO_CG": {
            "question": "Count: ☀☀ (2 suns) + ☀☀☀ (3 suns). How many total suns?",
            "answer": 5,
            "answer_type": "numeric"
        },
        "NO_TA": {
            "question": "You have 4 candies. You eat 1. How many are left?",
            "answer": 3,
            "answer_type": "numeric"
        },
        "NO_CGP3": {
            "question": "Add: ★★★ (3 stars) + ★★★★ (4 stars) = ? stars",
            "answer": 7,
            "answer_type": "numeric"
        },
        "NO_TAP3": {
            "question": "There are 8 birds on a tree. 3 fly away. How many birds are still on the tree?",
            "answer": 5,
            "answer_type": "numeric"
        },
        "NO_ADD30": {
            "question": "Add: 14 + 5 = ?",
            "answer": 19,
            "answer_type": "numeric"
        },
        "NO_SUB30": {
            "question": "Subtract: 23 - 4 = ?",
            "answer": 19,
            "answer_type": "numeric"
        },
        "MON_VOC": {
            "question": "Which word is related to money? (Pen, Rupee, Book, Chair)",
            "answer": "Rupee",
            "answer_type": "text"
        },
        "MON_COINS": {
            "question": "Which of these is a coin? (₹10 note, ₹5 coin, ₹100 note, ₹20 note)",
            "answer": "₹5 coin",
            "answer_type": "text"
        },
        "MON_NOTES": {
            "question": "Identify this currency: (Image of ₹10 note). What is the value?",
            "answer": "₹10",
            "answer_type": "text"
        },
        "MEAS_LEN": {
            "question": "Which is LONGER? (Picture of a pencil vs a crayon)",
            "answer": "pencil",
            "answer_type": "text"
        },
        "MEAS_WEIGHT": {
            "question": "Which is HEAVIER? (Picture of a book vs a feather)",
            "answer": "book",
            "answer_type": "text"
        },
        "MEAS_CAP": {
            "question": "Which glass is FULL? (Picture: one glass full of water, one empty)",
            "answer": "the full glass",
            "answer_type": "text"
        },
        "MEAS_LENCOMP": {
            "question": "Who is TALLER? (Picture: a child and a giraffe)",
            "answer": "giraffe",
            "answer_type": "text"
        },
        "MEAS_WTCOMP": {
            "question": "Which is HEAVIER? An elephant or a mouse?",
            "answer": "elephant",
            "answer_type": "text"
        },
        "MEAS_CAPVOC": {
            "question": "Which bottle holds MORE water? (Big bottle vs small bottle)",
            "answer": "big bottle",
            "answer_type": "text"
        },
        "MEAS_LENEXT": {
            "question": "Look at three ribbons: Red (long), Blue (longer), Green (longest). Which is the LONGEST?",
            "answer": "Green",
            "answer_type": "text"
        },
        "MEAS_WTEXT": {
            "question": "Among a feather, a book, and a table, which is the HEAVIEST?",
            "answer": "table",
            "answer_type": "text"
        },
        "MEAS_CAPCOMP": {
            "question": "Which jar can hold the most water? (Small cup, Medium mug, Large bucket)",
            "answer": "Large bucket",
            "answer_type": "text"
        },
        "SHAPE_BASIC": {
            "question": "Which shape is a ball? (Circle, Square, Triangle, Rectangle)",
            "answer": "Circle",
            "answer_type": "text"
        },
        "SHAPE_PF": {
            "question": "A dice has corners. How many corners does a cube have?",
            "answer": 8,
            "answer_type": "numeric"
        },
        "SHAPE_2D": {
            "question": "How many sides does a square have?",
            "answer": 4,
            "answer_type": "numeric"
        },
        "FRAC_VOC": {
            "question": "If you cut an apple into 2 equal parts, each part is called _____.",
            "answer": "half",
            "answer_type": "text"
        },
        "PAT_REP": {
            "question": "Clap your hands 3 times. Tap your feet 3 times. Repeat. What comes next after clap, clap, clap?",
            "answer": "tap, tap, tap",
            "answer_type": "text"
        },
        "PAT_EXT": {
            "question": "Complete the pattern: ○△○△○_",
            "answer": "△",
            "answer_type": "text"
        },
        "PAT_CREATE": {
            "question": "Draw the next shape in the pattern: △□△□△_",
            "answer": "□",
            "answer_type": "text"
        },
        "PAT_TRACE": {
            "question": "Trace and complete: ☆○☆○☆_",
            "answer": "○",
            "answer_type": "text"
        },
        "DATA_ID": {
            "question": "How many eyes do you have? Look in the mirror and count.",
            "answer": 2,
            "answer_type": "numeric"
        },
        "DATA_COLLECT": {
            "question": "Count the number of red objects in your classroom. Write the number.",
            "answer": 5,
            "answer_type": "numeric"
        },
        "DATA_OBS": {
            "question": "Look at the picture: There are 4 apples and 2 bananas. Which fruit has MORE?",
            "answer": "apples",
            "answer_type": "text"
        },
        "CAL_DLT": {
            "question": "If today is Monday, what day was yesterday?",
            "answer": "Sunday",
            "answer_type": "text"
        },
        "CAL_SPECIAL": {
            "question": "Which day is a holiday? (Monday, Sunday, Wednesday, Friday)",
            "answer": "Sunday",
            "answer_type": "text"
        },
        "CAL_DM": {
            "question": "How many days are in a week? Name any 3.",
            "answer": "7",
            "answer_type": "text"
        }
    }
    return question_bank.get(sid, {
        "question": f"Question for {name}: {desc}",
        "answer": "",
        "answer_type": "text"
    })

def generate_exam(syllabus, class_val, exam_id_prefix, phrase):
    exam = {
        "exam_id": f"{exam_id_prefix}_{phrase.upper()}",
        "class": class_val,
        "phrase": phrase,
        "total_questions": 0,
        "questions": []
    }
    qid = 1
    for topic in syllabus["topics"]:
        for subtopic in topic["subtopics"]:
            q_data = generate_questions_for_subtopic(syllabus, subtopic)
            question = {
                "question_id": f"Q{qid}",
                "question": q_data["question"],
                "answer": q_data["answer"],
                "answer_type": q_data["answer_type"],
                "topic": topic["topic_name"],
                "subtopic": subtopic["subtopic_name"],
                "class_level": class_val,
                "difficulty": subtopic["difficulty"],
                "source_level": subtopic["source"],
                "reasoning": f"Covers subtopic: {subtopic['subtopic_name']} - {subtopic['description']}"
            }
            exam["questions"].append(question)
            qid += 1
    exam["total_questions"] = len(exam["questions"])
    return exam

def main():
    base_path = "/home/shreya/fln/evaluation_metrics"
    syllabus_paths = {
        "phrase_1": f"{base_path}/syllabus/class_1/class_1_syllabus_phrase1.json",
        "phrase_2": f"{base_path}/syllabus/class_1/class_1_syllabus_phrase2.json",
        "phrase_3": f"{base_path}/syllabus/class_1/class_1_syllabus_phrase3.json"
    }
    for phrase, path in syllabus_paths.items():
        syllabus = load_syllabus(path)
        exam = generate_exam(syllabus, 1, "C1_WORKSHEET", phrase)
        out_dir = f"{base_path}/questions/class_1/{phrase}"
        os.makedirs(out_dir, exist_ok=True)
        out_path = f"{out_dir}/class_1_exam_{phrase}.json"
        with open(out_path, "w") as f:
            json.dump(exam, f, indent=2)
        print(f"Generated {out_path} with {exam['total_questions']} questions")
        for q in exam["questions"]:
            print(f"  {q['question_id']}: [{q['difficulty']}] {q['topic']} - {q['subtopic']}")

if __name__ == "__main__":
    main()
