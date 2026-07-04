# FLN Evaluation Metrics — Complete Reference Document

> **Author:** AI Engineer & FLN Researcher  
> **Generated:** Comprehensive analysis of the `evaluation_metrics` subsystem  
> **Scope:** All files in `/home/shreya/fln/evaluation_metrics/` except `Class1_Math_2pA4_Sets001-20/` and `student_responses/` (test data)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Directory Structure](#2-directory-structure)
3. [Configuration Layer](#3-configuration-layer)
4. [FLN Curriculum Syllabus — Classes 1–4](#4-fln-curriculum-syllabus--classes-1-4)
5. [Complete FLN Level Structure (Levels 1–59)](#5-complete-fln-level-structure-levels-1-59)
6. [Question Bank](#6-question-bank)
7. [Prompt Engineering Layer](#7-prompt-engineering-layer)
8. [Pipeline Scripts — End-to-End Evaluation Engine](#8-pipeline-scripts--end-to-end-evaluation-engine)
9. [Evaluation Reports — Real-World Case Studies](#9-evaluation-reports--real-world-case-studies)
10. [Architecture & Data Flow](#10-architecture--data-flow)
11. [Key Algorithms & Decision Rules](#11-key-algorithms--decision-rules)
12. [Analytical Insights](#12-analytical-insights)

---

## 1. System Overview

The **FLN (Foundational Learning Numeracy) Evaluation Metrics** system is an AI-powered pipeline designed to assess children's foundational numeracy against the **Indian NIPUN Bharat curriculum** (National Initiative for Proficiency in Reading with Understanding and Numeracy). It provides automated question classification, answer comparison, child evaluation, and report generation.

### Core Objectives

| Objective | Description |
|-----------|-------------|
| **Automated Classification** | Tag questions with topic, subtopic, class level, and difficulty |
| **Answer Comparison** | Compare student responses against answer keys |
| **Child Evaluation** | Determine root causes of errors and assign FLN remediation level |
| **Report Generation** | Produce teacher-friendly, actionable report cards |

### Technology Stack

| Component | Technology |
|-----------|-----------|
| Language | Python 3.10 |
| AI Model | `llama-3.1-8b-instant` (via Groq API) |
| API | Groq Cloud (`api.groq.com`) |
| Data Format | JSON (structured), TXT (reports) |
| Config | `.env` for API keys |

---

## 2. Directory Structure

```
evaluation_metrics/
├── .env                  # API key (GROQ_API_KEY)
├── .env.example          # Template for API key config
├── .gitignore            # Ignores __pycache__, .env, evaluation_reports/, student_responses/
├── requirements.txt      # Python dependencies (requests>=2.31.0)
│
├── prompts/              # LLM prompt templates (4 files)
│   ├── classify_question.txt
│   ├── evaluate_child.txt
│   ├── assign_level.txt
│   └── generate_report.txt
│
├── questions/            # Question banks by class
│   ├── class_1/
│   │   ├── class_1_exam.json        # 9 questions (worksheet)
│   │   └── class_1_exam.json.bak    # Auto-generated backup
│   ├── class_2/
│   │   ├── class_2_exam.json        # 10 questions (exam)
│   │   └── class_2_exam.json.bak    # Auto-generated backup
│   ├── class_3/          # Empty (no questions defined)
│   └── class_4/          # Empty (no questions defined)
│
├── scripts/              # 4-stage evaluation pipeline
│   ├── 0_auto_classify_questions.py   # Stage 0: Auto-classify
│   ├── 1_compare_answers.py           # Stage 1: Compare answers
│   ├── 2_evaluate_child.py            # Stage 2: Evaluate child
│   └── 3_generate_report.py           # Stage 3: Generate report
│
├── syllabus/             # Curriculum syllabi
│   ├── class_1_syllabus.json
│   ├── class_2_syllabus.json
│   ├── class_3_syllabus.json
│   └── class_4_syllabus.json
│
├── evaluation_reports/   # Generated outputs (6 students × 3 files each)
│   ├── STU_001_*.json/txt              # Aditya, Class 1, 2025-01-15
│   ├── STU_CLASS2_001_*.json/txt       # Rohit, Class 2, 2026-07-01
│   ├── STU_CLASS2_BORDER_*.json/txt    # Arjun, Class 2, 2026-07-01
│   ├── STU_CLASS2_PASS_*.json/txt      # Priya, Class 2, 2026-07-01
│   └── STU_TEST_001_*.json/txt         # Test Student, Class 1, 2026-06-30
│
├── Class1_Math_2pA4_Sets001-20/  # [EXCLUDED — test data]
└── student_responses/            # [EXCLUDED — test data]
```

### Student Response File Expected Schema (referenced by the pipeline)

```json
{
  "student_id": "STU_001",
  "student_name": "Student Name",
  "enrolled_class": 1,
  "test_date": "2025-01-15",
  "answers": {
    "Q1": { "answer": "response", "confidence": 0.95 },
    "Q2": { "answer": "response", "confidence": 0.9 }
  }
}
```

---

## 3. Configuration Layer

### `.env`
```
GROQ_API_KEY=your_api_key
```
Contains the Groq Cloud API key used by all scripts that call the LLM (classify, evaluate, report).

### `.env.example`
```
GROQ_API_KEY=your_key_here
```
Template for developers.

### `.gitignore`
```
__pycache__/
*.pyc
evaluation_reports/
.env
student_responses/
```
Excludes caches, generated reports, secrets, and test student data from version control.

### `requirements.txt`
```
requests>=2.31.0
```
Only dependency — HTTP client for the Groq API. No LLM SDK required; raw REST calls are used.

---

## 4. FLN Curriculum Syllabus — Classes 1–4

### Syllabus Design Principles

Each syllabus file defines:
- **difficulty_mapping** — Maps `easy`/`medium`/`hard` to source levels (Preschool 1–3, Class 1–3)
- **topics** — 9 topic areas × subtopics with difficulty, source level, and description

### Difficulty Mapping Matrix

| Enrolled Class | Easy | Medium | Hard |
|:---:|:---:|:---:|:---:|
| **Class 1** | Preschool 1 | Preschool 2 | Preschool 3 |
| **Class 2** | Preschool 1–2 | Preschool 3 | Class 1 |
| **Class 3** | Preschool 1–3 | Class 1 | Class 2 |
| **Class 4** | Preschool 1–3, Class 1 | Class 2 | Class 3 |

### 9 Topic Areas (across all classes)

| ID | Topic | Description |
|:---:|:---|:---|
| NS | Number Sense | Counting, numeral recognition, place value, comparison |
| NO | Number Operations | Addition, subtraction, multiplication, division |
| MON | Money | Coins, notes, transactions |
| MEAS | Measurement | Length, weight, capacity, standard/non-standard units |
| SHAPE | Shapes | 2D/3D shapes, properties |
| FRAC | Fractions | Half, quarter, fractions of collections |
| PAT | Patterns | Repeating, extending, creating patterns |
| DATA | Data Handling | Tally marks, pictographs, bar graphs |
| CAL | Calendar and Time | Days, months, clock reading |

### Class 1 Syllabus (372 lines) — Detailed Subtopics

**Difficulty: Easy (Preschool 1)**
- One-to-One Correspondence, Classification, Seriation, Counting (to 3), Number Rhymes, Length/Weight/Capacity Vocabulary, Repeating Patterns, Identifying Objects, Daily-Life Time

**Difficulty: Medium (Preschool 2)**
- Number Recognition (1-5), Comparing Quantities, Forward/Backward Counting (to 5), Zero Awareness, Combining Groups, Taking Away, Indian Coins, Length/Weight Comparison, Special Days, Collecting Objects

**Difficulty: Hard (Preschool 3)**
- Seriation (Advanced), Counting to 10, Forward/Backward (to 9), Numeral Writing (1-9), Comparing Numbers (up to 10), Combining Groups (up to 9), Currency Notes, Length/Weight/Capacity Comparison (Extended), 2D Shapes (circle, square, triangle, rectangle), Fraction Vocabulary (half), Creating Patterns, Observation & Inference, Days and Months

### Class 2 Syllabus (526 lines) — Detailed Subtopics

**Difficulty: Easy (Preschool 1–2)**
- One-to-One, Classification, Seriation, Counting to 5, Numeral Recognition (1-5), Zero Awareness, Comparing Numbers (up to 5), Forward/Backward (to 5), Early Addition Awareness, Combining Groups (to 5), Taking Away, Money Vocabulary, Indian Coins, Length/Weight/Capacity Vocabulary, Basic Shapes, Physical Features of Solids, Repeating Patterns, Pattern Extension, Identifying/Collecting Objects, Daily-Life Time, Special Days

**Difficulty: Medium (Preschool 3)**
- Classification (Multiple Factors), Seriation (4-5 Objects), Counting to 10, Forward/Backward (to 9), Numeral Writing (1-9), Zero Understanding, Comparing Numbers (up to 10), Combining Groups (to 9), Taking Away (from 9), Currency Notes, Length/Weight/Capacity Comparison (Extended), 2D Shapes, Fraction Vocabulary (half), Creating Patterns, Observation & Inference, Days and Months (recitation)

**Difficulty: Hard (Class 1)**
- Classification with position words, Seriation (5+ objects), Counting to 20, Forward/Backward (to 20), Number Reading/Writing (1-99), Understanding Zero, Comparing Numbers (up to 20), Addition (facts up to 18), Subtraction (facts up to 9), Addition-Subtraction Relationship, Repeated Addition (up to 10), Representing Money (up to ₹20), Non-standard Measurement, 3D Shapes, Half and Whole, Shape and Number Patterns, Collecting/Interpreting Data, Days and Months (identification)

### Class 3 Syllabus (414 lines) — Aggregated Subtopics

- **Easy**: All Preschool 1–3 skills aggregated (classification, seriation, counting, numeral recognition, comparing, operations, money vocab, measurement, shapes, fractions, patterns, data, time)
- **Medium**: Class 1 skills — classification with position words, seriation 5+, counting to 20, forward/backward to 20, numbers up to 99, comparing to 20, addition facts to 18, subtraction facts to 9, repeated addition, money to ₹20, non-standard measurement, 3D shapes, half and whole, shape/number patterns, data interpretation, days and months
- **Hard**: Class 2 skills — classification into categories, ascending/descending order, counting to 100 (tens), forward/backward to 99, numbers to 999, place value with zero, greatest/smallest 2-digit numbers, addition/subtraction strategies up to 99, multiplication tables 2-4, division, choosing operations, money to ₹100, standard measurement (cm/m/g/kg/L), lines and shapes, fractions (quarter, three-fourths), advanced number patterns, tally marks, dates and days

### Class 4 Syllabus (253 lines) — Aggregated Subtopics

- **Easy**: Preschool 1–3 + Class 1 skills (all foundational)
- **Medium**: Class 2 skills — numbers to 999, place value with zero, operations up to 99, multiplication tables 2-4, division basics, money to ₹100, standard units comparison, shape features, half/quarter, number patterns, data interpretation, calendar usage
- **Hard**: Class 3 skills — numbers to 9999, place value applications, standard algorithms to 999, multiplication tables 5-10, division with algorithm, money to ₹500, standard units (cm/m/g/kg/L), fractions (¼, ¾, of collections), advanced patterns, dates and day relationships, tally marks

---

## 5. Complete FLN Level Structure (Levels 1–59)

Defined in `prompts/assign_level.txt`, this is the most comprehensive curriculum map in the system. It spans **6 phases** covering pre-number concepts through advanced Class 4 mathematics.

### Phase 1: Pre-Number Concepts (Levels 1–3)

| Level | Name | Core Skills | Sub-levels |
|:---:|:---|:---|:---:|
| 1 | Quantity Comparison | Visual comparison (Equal, More, Less) | 1.0, 1.1, 1.2 |
| 2 | Odd One Out | Classification by shape/size/color/quantity/category | 2.0, 2.1, 2.2 |
| 3 | Matching + Tracing Lines | Association, visual discrimination, fine motor | 3.0, 3.1, 3.2 |

### Phase 2: Numbers 1–10 & Early Operations (Levels 4–11)

| Level | Name | Core Skills | Sub-levels |
|:---:|:---|:---|:---:|
| 4 | Numbers 1–10 | Recognize, trace, count, number names | 4.0, 4.1 |
| 5 | Finger Gesture Counting | Finger representations → quantities/numerals | 5.0, 5.1, 5.2 |
| 6 | After, Between, Before | Number sequence and position (1–10) | 6.0, 6.1, 6.2 |
| 7 | Addition Through Objects (1–10) | Combining groups, no carrying | 7.0, 7.1, 7.2 |
| 8 | Subtraction Through Objects (1–10) | Taking away, no borrowing | 8.0, 8.1, 8.2 |
| 9 | Pattern Recognition + Tracing | Visual/numerical patterns, fine motor | 9.0, 9.1, 9.2 |
| 10 | Comparison (Numeral) | >, <, = using numerals | 10.0, 10.1, 10.2 |
| 11 | Review Assessment | Cumulative Levels 1–10 | — |

### Phase 3: Numbers 11–50 & Expanded Operations (Levels 12–23)

| Level | Name | Core Skills |
|:---:|:---|:---|
| 12 | Tens and Ones | Place value with bundles/sticks (11–30) |
| 13 | Numbers 11–30 | Recognize, count, trace, number names |
| 14 | Counting + Fun Trace | Matching quantities with numerals |
| 15 | After, Between & Before (11–30) | Number sequencing |
| 16 | Addition (1–30) | No carrying |
| 17 | Subtraction (1–30) | No borrowing |
| 18 | Ordering (1–30) | Ascending/descending |
| 19 | Numbering 31–50 | Writing, sequencing, number names |
| 20 | Skip Counting (2s and 3s) | Pattern recognition, jump counting |
| 21 | Comparison (1–50) | >, <, = |
| 22 | Ordering (1–50) | Ascending/descending |
| 23 | Review Assessment | Cumulative Levels 12–22 |

### Phase 4: Numbers 51–100 & Operations with Regrouping (Levels 24–35)

| Level | Name | Core Skills |
|:---:|:---|:---|
| 24 | Numbers 51–100 | Number recognition, missing numbers |
| 25 | Place Value (Tens & Ones) | Decompose 2-digit numbers, expanded form |
| 26 | Carry Addition (within 100) | Column addition with regrouping |
| 27 | Borrow Subtraction (within 100) | Column subtraction with borrowing |
| 28 | Comparison (>, <, = within 100) | Place value comparison |
| 29 | Ordering (within 100) | Ascending/descending |
| 30 | Data Handling (Tally Marks) | Represent, interpret, compare data |
| 31 | Time | Analog clock — hours, half-hours, quarter-hours |
| 32 | Ordinal Positions (1st–10th) | Position identification |
| 33 | Multiplication (Repeated Addition) | Equal grouping, tables 2, 3, 4 |
| 34 | Measurement (Non-Standard & Standard) | Length, weight, capacity |
| 35 | Review Assessment | Cumulative Levels 24–34 |

### Phase 5: Numbers up to 1000 & Broad Concepts (Levels 36–48)

| Level | Name | Core Skills |
|:---:|:---|:---|
| 36 | Numbers 101–1000 | 3-digit place value, expanded form |
| 37 | Comparison (to 1000) | >, <, = for 3-digit numbers |
| 38 | Ordering (to 1000) | Ascending/descending |
| 39 | Addition (up to 1000) | With/without regrouping |
| 40 | Subtraction (up to 1000) | With/without regrouping, borrowing across zeros |
| 41 | Multiplication (Tables 2–10) | Fact fluency, vertical multiplication |
| 42 | Division (Introduction) | Equal sharing/grouping, inverse of multiplication |
| 43 | Standard Measurement & Conversions | cm/m, g/kg, ml/l |
| 44 | Time & Calendar | Clock (quarter past/to), calendar reading |
| 45 | Fractions | Half, third, fourth — representation and comparison |
| 46 | Money | Indian currency, counting, transactions, change |
| 47 | Data Handling | Pictographs, bar graphs, interpretation |
| 48 | Foundation Mastery Assessment | Cumulative Levels 36–47 |

### Phase 6: Advanced Mathematics (Levels 49–59)

| Level | Name | Core Skills |
|:---:|:---|:---|
| 49 | Numbers up to 10,000 | 4-digit place value |
| 50 | Advanced Multiplication | 2-digit × 2-digit, 3-digit × 1-digit |
| 51 | Advanced Division | Long division, remainders |
| 52 | Maps & Directions | Cardinal directions, spatial reasoning |
| 53 | Factors & Multiples | Factor pairs, common factors/multiples |
| 54 | Fraction Operations | Add/subtract like fractions |
| 55 | Decimals (Introduction) | Tenths, hundredths, money contexts |
| 56 | Area & Perimeter | Square units, side lengths |
| 57 | Angles | Right, acute, obtuse, straight |
| 58 | Symmetry & Reflection | Line of symmetry, mirror images |
| 59 | Advanced Mastery Assessment | Cumulative Levels 49–58 |

### Level Dependency Rules

- **Strict progression**: Each level must be mastered before progressing
- **Spiraling concepts**: Addition/Subtraction (Levels 7, 8, 16, 17, 26, 27, 39, 40) and Comparison/Ordering (Levels 1, 10, 18, 21, 22, 28, 29, 37, 38) spiral across number ranges
- **Review assessments**: Levels 11, 23, 35, 48, 59 test cumulative knowledge
- **Placement uses MINIMUM FAILURE LEVEL**: If child fails at Level 3 and Level 5, assign Level 3

---

## 6. Question Bank

### Class 1 Exam (`class_1_exam.json`)
- **Exam ID**: `C1_WORKSHEET_001`
- **Total Questions**: 9
- **Question Types**: matching, group_circle, fill_number, choice, cluster_loop, path_trace, mcq, dual_mark

| ID | Question | Topic | Difficulty | Answer Type |
|:---:|:---|:---|:---:|:---:|
| Q1 | Match shapes | Shapes | Easy | Text (matching pairs) |
| Q2 | Circle MORE/LESS groups | Number Sense | Medium | Text (4 cells) |
| Q3 | Fill missing numbers 5-10 | Number Sense | Hard | Text |
| Q4 | Tick the shorter tree | Measurement | Medium | Text |
| Q5 | Match pairs | Shapes | Easy | Text (matching pairs) |
| Q6 | Circle ₹1 coins | Money | Medium | Text |
| Q7 | Cut giftBox in half | Fractions | Hard | Text |
| Q8 | How many left? (jar of bees) | Number Operations | Medium | Numeric (0) |
| Q9 | Most/Least butterfly | Data Handling | Hard | Text |

### Class 2 Exam (`class_2_exam.json`)
- **Exam ID**: `C2_EXAM_001`
- **Total Questions**: 10
- **Answer Types**: numeric, text

| ID | Question | Topic | Difficulty | Source Level | Correct Answer |
|:---:|:---|:---|:---:|:---:|:---:|
| C2_Q001 | Count 7 stars | Number Sense | Easy | Preschool 2 | 7 |
| C2_Q002 | What comes after 8? | Number Sense | Medium | Preschool 3 | 9 |
| C2_Q003 | Arrange ascending: 5,2,8,1 | Number Sense | Medium | Preschool 3 | 1, 2, 5, 8 |
| C2_Q004 | Circle has how many sides? | Shapes | Medium | Preschool 3 | 0 |
| C2_Q005 | Heavier: brick or pencil? | Measurement | Easy | Preschool 2 | brick |
| C2_Q006 | 15 + 4 = ? | Number Operations | Easy | Preschool 3 | 19 |
| C2_Q007 | ₹12 − ₹5 = ? (word problem) | Number Operations/Money | Hard | Class 1 | 7 |
| C2_Q008 | Place value of 3 in 63? | Number Sense | Hard | Class 2 | ones |
| C2_Q009 | 45 + 23 = ? | Number Operations | Easy | Class 1 | 68 |
| C2_Q010 | 36 children, 18 boys, girls? | Number Operations | Hard | Preschool 3 | 18 |

### Class 3 and Class 4 Questions
Both folders are **empty** — no questions have been defined yet.

---

## 7. Prompt Engineering Layer

### 7.1 `classify_question.txt` (88 lines)

**Role**: Math FLN curriculum classifier

**Key Content**:
- Defines curriculum scope for Preschool 1–3, Class 1–3
- Defines difficulty mapping by enrolled class
- Defines difficulty characteristics:
  - **Easy**: Direct recall, no regrouping, single-digit, no context
  - **Medium**: One operation, some regrouping, two-digit, familiar context
  - **Hard**: Multiple steps, full regrouping, three-digit, word problems, abstract
- Instruction: `class_level` reflects actual curriculum level, not enrolled class

**Expected Output** (JSON):
```json
{
  "topic": "Number Sense|Number Operations|Money|Measurement|Shapes|Fractions|Patterns|Data Handling|Calendar and Time",
  "subtopic": "Specific skill being tested",
  "class_level": 1,
  "difficulty": "easy|medium|hard",
  "source_level": "Preschool 1|Preschool 2|Preschool 3|Class 1|Class 2|Class 3",
  "reasoning": "Brief explanation"
}
```

**Template Variable**: `{question}` — replaced with actual question text.

### 7.2 `evaluate_child.txt` (156 lines)

**Role**: FLN assessment expert — analyzes wrong answers, determines root causes, assigns level

**Key Components**:
1. **MINIMUM FAILURE LEVEL RULE**: Core logic — assign to lowest failing level
2. **Level Mapping**: Maps topics/subtopics to 59 FLN levels (103+ mappings)
3. **Evaluation Logic** (4 steps):
   - Step 1: Root cause classification (conceptual gap / careless mistake / prerequisite missing)
   - Step 2: Map wrong answers to FLN levels
   - Step 3: Apply minimum failure level rule
   - Step 4: Performance by difficulty analysis
4. **Performance Thresholds**: Easy >= 90%, Medium >= 70%, Hard >= 50%

**Expected Output** (JSON):
```json
{
  "root_causes": [{"question_id", "error", "topic", "fln_level", "error_type", "analysis"}],
  "performance_by_difficulty": {"easy": {"attempted", "correct"}, ...},
  "topics_to_focus": [],
  "levels_failed": [],
  "assigned_level": 3,
  "assign_reason": "Minimum failure level...",
  "prerequisites_to_check": [],
  "recommendation": "",
  "next_level_assignment": ""
}
```

### 7.3 `assign_level.txt` (417 lines)

**Role**: FLN level placement specialist — determines final FLN decision

**Key Components**:
1. **Decision Rules** (3-tier PASS/RETEST/EVALUATE):
   - **PASS**: Easy >= 90% AND Medium >= 50% AND Hard >= 40%
   - **RETEST**: Wrong <= 10% AND only easy questions wrong
   - **EVALUATE + LEVEL ASSIGN**: Everything else
2. **Complete FLN Level Structure**: All 59 levels, 6 phases, sub-levels, skills, dependencies
3. **Level Dependency Rules**: Strict progression, spiraling concepts
4. **Placement Analysis Methodology** (4 steps):
   - Step 1: Error type classification (conceptual / careless / prerequisite missing / language issue)
   - Step 2: Map each wrong answer to FLN levels
   - Step 3: **MINIMUM FAILURE LEVEL RULE**
   - Step 4: Confidence assessment (High: 0.85-1.0, Medium: 0.60-0.85, Low: 0.0-0.60)

**Expected Output** (JSON):
```json
{
  "student_id": "",
  "enrolled_class": 1,
  "assigned_level": 1,
  "confidence_score": 0.XX,
  "placement_rationale": "",
  "error_analysis": {
    "conceptual_gaps": [],
    "careless_mistakes": [],
    "prerequisites_missing": [],
    "language_issues": []
  },
  "recommended_action": "remediate|practice|promote|retest",
  "remediation_level": 1,
  "remediation_focus": [],
  "next_milestone": ""
}
```

### 7.4 `generate_report.txt` (109 lines)

**Role**: Converts AI evaluation into a teacher-friendly, actionable report card

**Key Sections**:
1. **Student Placement** — Assigned level with reason using minimum failure level rule
2. **Levels Where Child Struggled** — All levels with wrong answers, marked conceptual vs careless
3. **What Your Child Can Do** — Skills mastered at demonstrated level
4. **Areas for Growth** — By level with specific error examples
5. **Root Cause Analysis** — Conceptual gaps, prerequisites, expected vs observed
6. **Next Steps** — Short-term (1-2 weeks) and medium-term (1 month) action plan

**Tone Guidelines**: Encouraging but honest, simple language, growth-focused, specific actions, clear rationale

**Output Format**: Human-readable plain text with section headers, NOT JSON.

---

## 8. Pipeline Scripts — End-to-End Evaluation Engine

### 8.1 `0_auto_classify_questions.py` — Question Classification (182 lines)

**Purpose**: Auto-classify unclassified questions using Groq API

**Class**: `QuestionClassifier`

**Workflow**:
1. Loads `classify_question.txt` prompt template
2. Iterates through all `question_*.json` and `*_exam.json` files under `questions/`
3. Skips already-classified questions (those with a `topic` field)
4. Calls Groq API with `llama-3.1-8b-instant` (temperature 0.1, max 500 tokens)
5. Handles rate limiting (429) with exponential backoff (up to 5 retries)
6. Handles JSON parsing from code-block-wrapped responses
7. Creates `.bak` backup before overwriting
8. Updates question with classification + metadata

**Usage**:
```bash
python scripts/0_auto_classify_questions.py
python scripts/0_auto_classify_questions.py questions/class_2
```

### 8.2 `1_compare_answers.py` — Answer Comparison (162 lines)

**Purpose**: Compare student answers against question bank, compute stats

**Class**: `AnswerComparator`

**Workflow**:
1. Loads all questions from `questions/` into `self.questions_db` database
2. Reads student response file (JSON)
3. For each answer: compares string-equality, records correct/wrong
4. Groups wrong answers by difficulty (easy/medium/hard/unknown)
5. Determines decision: `RETEST`, `PLACE_AT_LEVEL`, or `EVALUATE`
6. Saves comparison result as JSON to `evaluation_reports/`

**Decision Logic** (`_determine_decision`):
- Wrong ≤ 10% AND only easy wrong → `RETEST`
- Wrong ≤ 10% AND only hard wrong → `PLACE_AT_LEVEL`
- 0% wrong → `PLACE_AT_LEVEL`
- Everything else → `EVALUATE`

**Usage**:
```bash
python scripts/1_compare_answers.py student_responses/STU_001_class1_2025-01-15.json
```

### 8.3 `2_evaluate_child.py` — Child Evaluation (331 lines)

**Purpose**: Analyze wrong answers, identify root causes, assign FLN remediation level

**Class**: `ChildEvaluator`

**Workflow**:
1. Loads comparison result + syllabus for enrolled class
2. **Quick path — RETEST**: Returns retest recommendation if decision is RETEST
3. **Quick path — PASS**: Checks thresholds (Easy ≥ 90%, Medium ≥ 50%, Hard ≥ 40%) — if met, returns PASS
4. **AI path — EVALUATE**: Otherwise, calls Groq API with `evaluate_child.txt` prompt
5. Strips complex answer types (lists/dicts) for clean LLM input
6. Parses AI response, extracts root causes, levels failed, assigned level
7. Falls back to heuristic if AI response is missing fields
8. Saves evaluation JSON to `evaluation_reports/`

**Performance Thresholds** (hardcoded):
- Easy ≥ 90% → PASS condition
- Medium ≥ 50% → PASS condition  
- Hard ≥ 40% → PASS condition

**Heuristic Fallbacks** (when AI fails to parse):
- Wrong < 10% → demonstrated = enrolled, confidence 0.95
- Wrong < 25% → demonstrated = enrolled, confidence 0.75
- Wrong ≥ 25% → demonstrated = max(0, enrolled-1), confidence 0.60

**Usage**:
```bash
python scripts/2_evaluate_child.py STU_001 1
```

### 8.4 `3_generate_report.py` — Report Card Generation (336 lines)

**Purpose**: Generate teacher-friendly report cards from evaluation data

**Class**: `ReportGenerator`

**Workflow**:
1. Loads evaluation JSON
2. Routes to appropriate report generator based on `decision`:
   - **RETEST**: Simple retest notification template
   - **PASS**: Pass certificate with performance breakdown
   - **Default**: AI-generated report (calls Groq with `generate_report.txt` prompt)
3. **AI fallback**: If AI call fails, uses `_generate_template_report` — a comprehensive template
4. Saves report as `.txt` to `evaluation_reports/`

**Report Templates**:
- `_generate_retest_report`: Minimal — decision, reason, retest schedule
- `_generate_pass_report`: Performance by difficulty, threshold checks, next steps
- `_generate_ai_report`: Uses LLM with full evaluation context, tone guidance
- `_generate_template_report`: Full template with placement, weakness areas, can-do list, growth areas, root cause analysis, next steps

**Skill Level Reference** (`_get_can_do_list`): Hardcoded ability lists for Class 1, 2, 3

**Usage**:
```bash
python scripts/3_generate_report.py evaluation_reports/STU_001_evaluation_2025-01-15.json Aditya
```

---

## 9. Evaluation Reports — Real-World Case Studies

### 9.1 STU_001 — Aditya (Class 1, Enrolled 2025-01-15)

**Comparison Stats**: 8/10 correct, 20% wrong, Decision: `EVALUATE`

**Evaluation Outcome**:
| Field | Value |
|:---|:---|
| Demonstrated Level | Class 1 |
| Confidence | 75% |
| Error Type | careless |
| Wrong Count | 2 (easy questions only) |

**Root Causes**:
1. **C1_Q003** (Subtraction 6 vs 5): Careless mistake — knows concept, arithmetic error
2. **C1_Q009** (Weight comparison feather vs stones): Conceptual gap — doesn't understand weight comparison

**Recommendation**: Practice arithmetic, review number sense foundational skills
**Next Level**: Class 2

**Report Highlights** (Generated: 2026-06-27):
- Placement: Class 1 (demonstrated), Boundary: Class 1
- "Child is solid at Class 1. With focused practice, ready for next level soon."
- Can-do: Count to 20, single-digit add/sub, read numerals to 99, compare numbers, 3D shapes, place value, non-standard measurement
- Areas for Growth: Subtraction fact error, weight comparison concept
- Next Steps: Practice arithmetic, review number recognition


## 10. Architecture & Data Flow

### Pipeline Flow Diagram

```
[Student Response JSON]
         │
         ▼
┌─────────────────────┐
│  0. Auto-Classify   │  ← Groq API (llama-3.1-8b-instant)
│  Questions          │     Prompt: classify_question.txt
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  1. Compare         │  ← Exact string matching
│  Answers            │     Output: *_comparison_*.json
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  2. Evaluate Child  │
│                     │── RETEST → Quick exit (retest recommendation)
│                     │── PASS  → Quick exit (threshold check)
│                     │── EVALUATE → Groq API call (evaluate_child.txt / assign_level.txt)
│                     │     Output: *_evaluation_*.json
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  3. Generate Report │
│                     │── RETEST → Template retest notification
│                     │── PASS  → Template pass certificate
│                     │── Default → Groq API call (generate_report.txt)
│                     │     Fallback: Template report
│                     │     Output: *_report_*.txt
└─────────────────────┘
```

### Data Dependencies

| Script | Input | Output | External API |
|:---|:---|:---|:---:|
| `0_auto_classify` | `questions/*/*.json` | Updated questions + `.bak` | Groq (classify_question.txt) |
| `1_compare_answers` | Student response JSON, question bank | `*_comparison_*.json` | None |
| `2_evaluate_child` | `*_comparison_*.json`, syllabus JSON | `*_evaluation_*.json` | Groq (evaluate_child.txt / assign_level.txt) |
| `3_generate_report` | `*_evaluation_*.json` | `*_report_*.txt` | Groq (generate_report.txt) |

### API Configuration

| Parameter | Value |
|:---|:---:|
| Endpoint | `https://api.groq.com/openai/v1/chat/completions` |
| Model | `llama-3.1-8b-instant` |
| Temperature | Classify: 0.1, Evaluate: 0.1, Report: 0.3 |
| Max Tokens | Classify: 500, Evaluate: 1500, Report: 2000 |
| Timeout | Classify: 30s, Evaluate: 300s, Report: 300s |
| Retries | Classify: 5 (exponential backoff), Evaluate: 0, Report: 0 |

---

## 11. Key Algorithms & Decision Rules

### 11.1 Three-Tier Decision System

```
                      ┌─────────────────────────┐
                      │  Wrong Percentage       │
                      │  (from answer compare)  │
                      └───────────┬─────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
               ≤ 10% wrong                  > 10% wrong
                    │                           │
          ┌─────────┴─────────┐                 │
          │                   │                 │
    Only easy wrong      Other wrong        EVALUATE
          │                   │
      RETEST            PLACE_AT_LEVEL / EVALUATE
```

### 11.2 PASS Thresholds (in `evaluate_child.py`)

```
IF (Easy ≥ 90% correct) AND (Medium ≥ 50% correct) AND (Hard ≥ 40% correct) → PASS
ELSE → EVALUATE (call AI)
```

Note: The `assign_level.txt` prompt uses the same thresholds but applies them within the AI prompt rather than in code.

### 11.3 Minimum Failure Level Rule

```
Given levels_failed = [set of FLN levels where child has conceptual gaps]
assigned_level = min(levels_failed)

Rationale: Higher-level skills depend on foundational levels.
Example: Levels failed = [3, 10, 12, 17, 8] → assigned_level = 3
```

### 11.4 Error Type Classification (in AI prompts)

| Error Type | Definition | Action |
|:---|:---|:---|
| Conceptual Gap | Child doesn't understand the concept | Remediation needed at that level |
| Careless Mistake | Child knows concept but made arithmetic/reading error | Practice needed, not level change |
| Prerequisite Missing | Foundational skill from earlier level absent | Review earlier levels first |
| Language/Comprehension Issue | Child misunderstood wording | Simplify language, retest |

### 11.5 Confidence Scoring

| Confidence Range | Label | Criteria |
|:---:|:---|:---|
| 0.85–1.00 | High | Multiple wrong answers consistently point to same level gap |
| 0.60–0.85 | Medium | Some indication but pattern not fully clear |
| 0.00–0.60 | Low | Few wrong answers or span too many levels |

### 11.6 Heuristic Fallback (when AI fails)

```
IF wrong_percentage < 10%:
    demonstrated_level = enrolled_class (confidence 0.95)
ELIF wrong_percentage < 25%:
    demonstrated_level = enrolled_class (confidence 0.75)
ELSE:
    demonstrated_level = max(0, enrolled_class - 1) (confidence 0.60)
```

### 11.7 Question Classification Difficulty Rules

| Difficulty | Characteristics |
|:---|:---|
| Easy | Direct recall, no regrouping/borrowing, single-digit, no context |
| Medium | One operation, some regrouping, two-digit numbers, familiar context |
| Hard | Multiple steps, full regrouping/borrowing, three-digit numbers, word problems, abstract |

---

## 12. Analytical Insights

### 12.1 Strengths

1. **Comprehensive curriculum coverage**: 59 FLN levels across 6 phases mapped to all 9 topic areas
2. **Multi-layered decision system**: Code-level thresholds AND AI-level analysis provide redundancy
3. **Graceful degradation**: Every script has fallback mechanisms (template reports, heuristic level assignment, backup files)
4. **Teacher-friendly outputs**: Report cards are actionable, specific, and growth-focused
5. **Modular architecture**: 4 independent scripts can be run separately or as a pipeline
6. **Version control awareness**: `.bak` files, `.gitignore`, and environment separation

### 12.2 Limitations & Gaps

1. **No Class 3 or Class 4 questions**: `questions/class_3/` and `questions/class_4/` are empty — the pipeline cannot evaluate Class 3 or 4 students
2. **Simple answer comparison**: Uses exact string matching — no tolerance for equivalent correct answers (e.g., "zero" vs "0")
3. **Single model dependency**: All AI calls use `llama-3.1-8b-instant` — no fallback model or model selection
4. **No caching**: Every evaluation calls the API fresh — no caching of similar evaluations
5. **No rate limit handling in evaluate/report scripts**: Only `auto_classify` handles 429 rate limits
6. **Mixed difficulty scales**: The PASS thresholds (90/50/40) differ from the AI prompt recommendations (90/70/50)
7. **Hardcoded performance thresholds**: Easy 90%, Medium 50%, Hard 40% are hardcoded in `evaluate_child.py` — but the prompt says 90%/70%/50%
8. **No test harness**: No unit tests, integration tests, or validation scripts
9. **Complex answer type handling**: When answers are lists/dicts, the comparison script converts them to string representations for equality comparison, which may produce false negatives
10. **No cross-class question validation**: Questions tagged for Class 1 may appear in a Class 2 student's exam, affecting difficulty mapping

### 12.3 Edge Cases Observed

1. **`STU_CLASS2_PASS`** (10/10 correct): Decision `PLACE_AT_LEVEL` → never reaches AI evaluation, directly returns PASS
2. **`STU_TEST_001`** (Q3): Student answered "5" but correct answer is empty string `""` → automatic wrong even if "5" might be valid
3. **`STU_001`**: Wrong percentage 20% but ALL wrong answers are easy questions → triggers EVALUATE, not RETEST (because 20% > 10% threshold)
4. **AI JSON parsing fragility**: The code strips markdown code fences (` ``` `) but doesn't handle all edge cases in AI output formatting

### 12.4 Recommendations

1. Add Class 3 and Class 4 question banks to complete the pipeline
2. Implement fuzzy answer matching for equivalent correct responses
3. Add model fallback chain (e.g., try smaller model first, fall back to larger)
4. Harmonize PASS thresholds between code and prompts
5. Add unit tests and a validation suite
6. Implement evaluation caching for identical/similar error patterns
7. Add rate limit handling to all API-calling scripts
8. Consider adding an OCR preprocessing stage for handwritten answer recognition
9. Add a monitoring dashboard showing evaluation trends across students, classes, and levels
10. Consider adding multi-language support for Hindi/regional language questions (relevant for Indian FLN context)

### 12.5 Data Summary

| Metric | Value |
|:---|:---:|
| Total FLN Levels | 59 |
| Learning Phases | 6 |
| Topic Areas | 9 |
| Prompt Templates | 4 |
| Pipeline Scripts | 4 |
| Syllabus Files | 4 |
| Question Banks | 2 (Class 1 & 2) |
| Total Questions | 19 (9 + 10) |
| Evaluation Reports | 5 students × 3 files = 15 files |
| Students Evaluated (real) | 4 (Aditya, Rohit, Arjun, Priya) + 1 test |
| AI API Calls per Student | Up to 2 (evaluate + report) |
| Primary AI Model | `llama-3.1-8b-instant` |
| External Dependency | Groq API |

---

*Generated by AI Engineer & FLN Researcher — Complete analysis of `evaluation_metrics/` subsystem.*
*This document covers all files and logic within the directory except test data folders (`Class1_Math_2pA4_Sets001-20` and `student_responses`).*
