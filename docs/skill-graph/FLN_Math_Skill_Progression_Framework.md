# FLN Mathematics Skill-Progression Framework
## Mapping 27 Levels → Core Skills → Granular Subskills → Prerequisites → Question Types → Student Evidence

### 1. Purpose

This document proposes a practical framework for turning the existing 27 FLN mathematics levels into a reusable knowledge model.

The proposed hierarchy is:

**27 Levels → 15–25 Core Skills → 50–100 Granular Subskills → Prerequisites → Question Types → Student Evidence**

The goal is not to copy an existing international framework. It is to combine established ideas from learning trajectories, learning progressions, knowledge components, and assessment evidence into a framework appropriate for the FLN project.

---

## 2. Has this been done before?

### Short answer: Yes, but not in exactly this form.

Several established systems contain major pieces of the proposed architecture.

### 2.1 Learning Trajectories

The Learning Trajectories project models mathematics as:

**Mathematical Goal → Developmental Levels → Instructional Tasks**

Its levels represent increasingly sophisticated ways children think about a mathematical goal. The framework explicitly says that the levels can support curriculum developers and teachers in sequencing activities and assessing children's current thinking.

Reference:
https://www.learningtrajectories.org/

This is the closest conceptual precedent for the **Level → Skill progression** part of the proposed FLN system.

### 2.2 Early Math Trajectories research

Rittle-Johnson et al. developed an early mathematics trajectories model following children from approximately ages 4 to 11. It included nonsymbolic quantity, counting, symbolic mapping, calculation, patterning and shape knowledge.

Importantly, by the end of first grade, symbolic mapping, calculation and patterning were significant predictors in the studied model.

Reference:
https://doi.org/10.1111/cdev.12662

This supports treating early mathematics as multiple related skill domains rather than one single "math ability."

### 2.3 NWEA Learning Continuum

NWEA's MAP Growth Learning Continuum organizes assessment content into learning statements associated with score bands and instructional areas. It is used to understand what skills and concepts are associated with different levels of performance.

Reference:
https://nweapss-admin.mapnwea.org/assist/help_map/Content/Data/SampleReports/LearningContinuumRef.htm

This is a useful precedent for connecting:

**performance level → learning statement → instructional decision**

### 2.4 Knowledge Components / Knowledge Tracing

Knowledge tracing research represents student performance using knowledge components or skills and uses response history to estimate changing mastery.

ASSISTments datasets, for example, explicitly associate problems with skill identifiers. The FoundationalASSIST dataset contains 224 unique skills and links problems to skill IDs.

Reference:
https://huggingface.co/datasets/ASSISTments/FoundationalASSIST

This gives a strong precedent for:

**Question → Skill → Student response → estimated knowledge**

### 2.5 Learning progressions / prerequisite graphs

Learning Commons provides a knowledge-graph approach in which standards are connected through learning progressions and potentially useful prerequisite relationships.

An important warning from that project is that prerequisite relationships should not automatically be interpreted as strict requirements. They can represent relationships that are helpful in a particular learning situation.

Reference:
https://docs.learningcommons.org/knowledge-graph/getting-started/tutorials/generating-prerequisite-practice-questions

### 2.6 Recent early-math research

A 2026 review proposes a skill-specific structure for early mathematics with nested levels of:

**domains → subdomains → specific skills**

It identifies numeracy, geometry, patterning and measurement among the major early-math domains.

Reference:
https://doi.org/10.1016/j.dr.2026.101268

---

## 3. What is different about the proposed FLN model?

The proposed FLN model combines these ideas around the project's own 27 levels:

```text
27 FLN Levels
      ↓
Core Mathematical Skills
      ↓
Granular Subskills
      ↓
Prerequisite / Related Skills
      ↓
Question Types
      ↓
Student Evidence
      ↓
Mastery / Gap Estimate
      ↓
Next Assessment / Intervention
```

The novelty is therefore not claiming that the world has never represented mathematics this way.

The useful contribution is building a **small, transparent, India/FLN-specific operational model** that connects the project's existing levels directly to questions and student evidence.

---

# 4. Proposed architecture

## Layer 1 — Level

The existing 27 levels remain the learner-facing progression.

Examples:

- L1 Quantity Comparison
- L7 Addition through objects
- L12 Tens and Ones
- L26 Carry Addition
- L27 Borrow Subtraction

A level is a **learning checkpoint**, not necessarily a single skill.

---

## Layer 2 — Core Skill

Create approximately 15–25 stable mathematical skills.

Recommended initial taxonomy:

1. Quantity Awareness
2. Classification
3. Matching / Correspondence
4. Counting
5. Cardinality
6. Numeral Recognition
7. Number Sequence
8. Number Comparison
9. Number Ordering
10. Number Composition / Decomposition
11. Addition
12. Subtraction
13. Patterns
14. Skip Counting
15. Place Value
16. Number Representation
17. Regrouping
18. Mathematical Reasoning
19. Problem Solving
20. Mathematical Communication
21. Spatial / Shape Reasoning
22. Measurement
23. Time / Money
24. Data Handling

Do not assume every skill must occur in all 27 levels.

---

# 5. Granular subskills

Each core skill should be decomposed into observable subskills.

Example:

## Counting

```text
COUNTING
├── verbal counting sequence
├── one-to-one correspondence
├── counting objects
├── counting from 1
├── counting from a given number
├── counting forward
├── counting backward
├── cardinality
├── counting within 10
├── counting within 30
├── counting within 50
└── counting within 100
```

## Number Comparison

```text
NUMBER COMPARISON
├── compare quantities visually
├── identify more
├── identify less
├── identify equal
├── compare numerals
├── compare within 10
├── compare within 30
├── compare within 50
└── compare using tens and ones
```

## Addition

```text
ADDITION
├── combine two sets
├── represent addition with objects
├── represent addition pictorially
├── addition sentence
├── add within 10
├── add within 20
├── add within 30
├── add using place value
└── regroup/carry
```

## Subtraction

```text
SUBTRACTION
├── take away objects
├── identify remaining quantity
├── represent subtraction pictorially
├── subtraction sentence
├── subtract within 10
├── subtract within 20
├── subtract within 30
├── subtract using place value
└── regroup/borrow
```

---

# 6. Map the current 27 levels

## L1 — Quantity Comparison

Core skills:

- Quantity Awareness
- Number Comparison

Subskills:

- visually compare two collections
- identify more
- identify less
- identify equal quantities
- use one-to-one matching to compare

Prerequisites:

- object recognition
- one-to-one correspondence

Question types:

- circle the group with more objects
- circle the group with fewer objects
- identify equal groups
- compare two visual collections

Student evidence:

```text
correct_quantity_comparison
comparison_error
one_to_one_matching_error
more_less_confusion
```

---

## L2 — Odd One Out

Core skills:

- Classification
- Mathematical Reasoning

Subskills:

- identify common attribute
- identify different attribute
- classify by shape
- classify by size
- classify by color
- explain why an item is different

Question types:

- select odd object
- select object that does not belong
- classify objects

Evidence:

```text
attribute_recognition
classification_success
classification_error
```

---

## L3 — Matching + Tracing Lines

Core skills:

- Matching / Correspondence
- Visual-Spatial Coordination

Subskills:

- one-to-one matching
- visual tracking
- connect corresponding objects
- follow a path
- basic fine-motor control

Question types:

- match object pairs
- connect identical objects
- trace a line

Evidence:

```text
matching_accuracy
correspondence_accuracy
tracing_completion
```

---

## L4 — Numbers 1–10

Core skills:

- Counting
- Numeral Recognition
- Number Representation

Subskills:

- recognize numerals 1–10
- associate numeral with quantity
- count objects to 10
- sequence numerals

Evidence:

```text
numeral_recognition
quantity_numeral_mapping
counting_accuracy
```

---

## L5 — Finger Gesture Counting

Core skills:

- Counting
- Quantity Representation
- Cardinality

Subskills:

- represent quantity using fingers
- count fingers
- map fingers to number
- identify quantity from gesture

---

## L6 — Before / After / Between

Core skills:

- Number Sequence
- Number Relationships

Subskills:

- successor
- predecessor
- missing number
- number between two numbers
- sequence completion

---

## L7 — Addition Through Objects

Core skills:

- Addition
- Counting
- Number Representation

Subskills:

- combine sets
- count combined quantity
- represent addition using objects
- understand addition as joining
- connect objects to addition sentence

---

## L8 — Subtraction 1–10

Core skills:

- Subtraction
- Counting
- Number Representation

Subskills:

- take away
- count remaining objects
- represent subtraction
- connect situation to subtraction sentence

---

## L9 — Pattern Recognition + Draw by Tracing

Core skills:

- Pattern Recognition
- Visual-Spatial Coordination

Subskills:

- identify repeating unit
- identify next element
- extend pattern
- copy pattern
- trace pattern

---

## L10 — Comparison – Numeral

Core skills:

- Number Comparison
- Numeral Recognition

Subskills:

- compare two numerals
- identify greater number
- identify smaller number
- identify equal numbers

---

## L11 — Review Assessment

This should **not be treated as a new skill**.

Instead:

```text
L11
 ↓
Assessment checkpoint
 ↓
measure L1–L10 skills
 ↓
identify mastered / developing / weak skills
```

---

## L12 — Tens and Ones

Core skills:

- Place Value
- Number Composition / Decomposition

Subskills:

- group objects into tens
- identify tens
- identify ones
- represent two-digit numbers
- compose number from tens and ones

---

## L13 — Numbers 11–30

Core skills:

- Numeral Recognition
- Counting
- Place Value

Subskills:

- read 11–30
- write 11–30
- sequence 11–30
- map numeral to quantity
- identify tens/ones informally

---

## L14 — Counting + Fun Trace

Core skills:

- Counting
- Number Writing

Subskills:

- counting fluency
- sequence completion
- number formation
- visual tracking

---

## L15 — Before / Between / After

Core skills:

- Number Sequence
- Number Relationships

Subskills:

- predecessor
- successor
- between
- missing number
- sequence completion within 30

---

## L16 — Addition 1–30

Core skills:

- Addition
- Number Sense
- Number Representation

Subskills:

- addition within 20
- addition within 30
- counting-on strategy
- decomposition strategy
- equation completion
- contextual addition

---

## L17 — Subtraction 1–30

Core skills:

- Subtraction
- Number Sense

Subskills:

- subtraction within 20
- subtraction within 30
- counting-back strategy
- missing-part problems
- contextual subtraction

---

## L18 — Ordering 1–30

Core skills:

- Number Ordering
- Number Comparison

Subskills:

- ascending order
- descending order
- smallest/largest
- sequence numbers
- order multiple numerals

---

## L19 — Numbers 31–50

Core skills:

- Numeration
- Counting
- Place Value

Subskills:

- read 31–50
- write 31–50
- sequence
- numeral-quantity mapping

---

## L20 — Skip Counting in 2s/3s

Core skills:

- Skip Counting
- Patterns
- Multiplicative Thinking Readiness

Subskills:

- count by 2
- count by 3
- identify skip-count pattern
- complete missing terms
- connect equal groups to skip counting

---

## L21 — Comparison 1–50

Core skills:

- Number Comparison
- Place Value

Subskills:

- compare two-digit numbers
- compare tens
- compare ones when tens equal
- greater/less/equal

---

## L22 — Ordering 1–50

Core skills:

- Number Ordering
- Comparison
- Place Value

Subskills:

- order two-digit numbers
- ascending order
- descending order
- identify number position

---

## L23 — Review Assessment

Assessment checkpoint for L12–L22.

Possible evidence:

```text
number_sense_mastery
place_value_mastery
addition_mastery
subtraction_mastery
ordering_mastery
skip_counting_mastery
```

---

## L24 — Numbers 51–100

Core skills:

- Numeration
- Counting
- Place Value

Subskills:

- read 51–100
- write 51–100
- sequence
- identify missing numbers
- connect number to quantity

---

## L25 — Place Value Tens & Ones

Core skills:

- Place Value
- Number Composition / Decomposition

Subskills:

- identify tens digit
- identify ones digit
- compose two-digit number
- decompose two-digit number
- compare numbers using tens/ones

---

## L26 — Carry Addition

Core skills:

- Addition
- Place Value
- Regrouping

Subskills:

- column addition
- add ones
- regroup 10 ones as 1 ten
- carry to tens
- complete two-digit addition

Prerequisites:

```text
L16 Addition
L25 Place Value
```

---

## L27 — Borrow Subtraction

Core skills:

- Subtraction
- Place Value
- Regrouping

Subskills:

- column subtraction
- subtract ones
- recognize insufficient ones
- decompose one ten into ten ones
- subtract after regrouping

Prerequisites:

```text
L17 Subtraction
L25 Place Value
```

---

# 7. The level-skill matrix

A useful database representation is:

| Level | Core skills |
|---|---|
| L1 | Quantity Awareness, Comparison |
| L2 | Classification, Reasoning |
| L3 | Matching, Spatial Coordination |
| L4 | Counting, Numeral Recognition |
| L5 | Counting, Cardinality |
| L6 | Number Sequence |
| L7 | Addition, Counting, Representation |
| L8 | Subtraction, Counting, Representation |
| L9 | Patterns, Spatial Coordination |
| L10 | Comparison, Numeral Recognition |
| L11 | Assessment |
| L12 | Place Value, Composition |
| L13 | Numeration, Counting, Place Value |
| L14 | Counting, Number Writing |
| L15 | Number Sequence |
| L16 | Addition, Number Sense |
| L17 | Subtraction, Number Sense |
| L18 | Ordering, Comparison |
| L19 | Numeration, Place Value |
| L20 | Skip Counting, Patterns |
| L21 | Comparison, Place Value |
| L22 | Ordering, Comparison, Place Value |
| L23 | Assessment |
| L24 | Numeration, Counting, Place Value |
| L25 | Place Value, Composition |
| L26 | Addition, Place Value, Regrouping |
| L27 | Subtraction, Place Value, Regrouping |

---

# 8. Prerequisite graph

The most important relationships should be represented explicitly.

```text
Quantity Awareness
        ↓
Counting
        ↓
Cardinality
        ↓
Numeral Recognition
        ↓
Number Sequence
        ↓
Number Comparison
        ↓
Number Ordering
        ↓
Place Value
        ↓
Regrouping
     ↙      ↘
Carry +   Borrow -
```

Addition:

```text
Counting
   ↓
Quantity Composition
   ↓
Concrete Addition
   ↓
Symbolic Addition
   ↓
Addition within 30
   ↓
Place Value
   ↓
Regrouping
   ↓
Carry Addition
```

Subtraction:

```text
Counting
   ↓
Taking Away
   ↓
Concrete Subtraction
   ↓
Symbolic Subtraction
   ↓
Subtraction within 30
   ↓
Place Value
   ↓
Decomposition
   ↓
Borrow Subtraction
```

---

# 9. Question types should be attached to subskills

Do not only store:

```text
question.competency = "Addition"
```

Instead:

```json
{
  "questionType": "object_addition",
  "skills": [
    "addition",
    "counting",
    "quantity_composition"
  ],
  "level": "L7"
}
```

Another question:

```json
{
  "questionType": "two_digit_addition_regrouping",
  "skills": [
    "addition",
    "place_value",
    "regrouping"
  ],
  "level": "L26"
}
```

This allows the same skill to appear across many levels.

---

# 10. Student evidence model

The system should not store only:

```text
correct = true
```

Store structured evidence.

Example:

```json
{
  "studentId": "S001",
  "questionId": "Q1023",
  "level": "L21",

  "skillEvidence": [
    {
      "skill": "number_comparison",
      "result": "correct"
    },
    {
      "skill": "place_value",
      "result": "incorrect"
    }
  ]
}
```

Over multiple questions:

```text
Student
   ↓
Question attempts
   ↓
Skill evidence
   ↓
Subskill performance
   ↓
Mastery estimate
```

---

# 11. Don't make prerequisites binary

This is important.

Do not define:

```text
A → B
```

as:

> "The child absolutely cannot learn B unless A is mastered."

Learning progressions research warns against treating progression relationships as definitive prerequisites. They can instead represent relationships that are helpful or supportive in a given context.

Therefore use:

```text
relationshipType:
    "supports"
    "often_precedes"
    "related_to"
    "required_for_procedure"
```

For example:

```text
Counting
   ──supports──> Addition

Place Value
   ──required_for_procedure──> Carry Addition
```

This is more educationally defensible.

---

# 12. Recommended MongoDB model

## skills

```json
{
  "_id": "SKILL_PLACE_VALUE",
  "name": "Place Value",
  "domain": "Number Sense",
  "description": "Understanding tens and ones in two-digit numbers"
}
```

## subskills

```json
{
  "_id": "SUBSKILL_TENS_ONES",
  "skillId": "SKILL_PLACE_VALUE",
  "name": "Identify tens and ones",
  "observable": true
}
```

## levels

```json
{
  "_id": "L26",
  "name": "Carry Addition",
  "sequence": 26,
  "skills": [
    "SKILL_ADDITION",
    "SKILL_PLACE_VALUE",
    "SKILL_REGROUPING"
  ]
}
```

## relationships

```json
{
  "from": "SKILL_PLACE_VALUE",
  "to": "SKILL_REGROUPING",
  "relationship": "supports"
}
```

## questions

```json
{
  "_id": "Q26_001",
  "level": "L26",

  "skills": [
    "SKILL_ADDITION",
    "SKILL_PLACE_VALUE",
    "SKILL_REGROUPING"
  ],

  "subskills": [
    "SUB_ADD_ONES",
    "SUB_REGROUP_TEN"
  ],

  "questionType": "two_digit_addition_regrouping"
}
```

---

# 13. Student mastery layer

Eventually:

```text
Student
   ↓
Evidence
   ↓
Subskill mastery
   ↓
Core skill mastery
   ↓
Level readiness
```

For example:

```json
{
  "studentId": "S001",

  "skillMastery": {
    "counting": 0.92,
    "number_comparison": 0.81,
    "addition": 0.74,
    "subtraction": 0.68,
    "place_value": 0.43,
    "regrouping": 0.21
  }
}
```

The numbers here are illustrative; in production they should come from a defined mastery-estimation method rather than arbitrary percentages.

---

# 14. The question generator becomes much smarter

Instead of:

```text
Generate an L26 question.
```

the system can ask:

```text
Generate an L26 question that targets:

Primary subskill:
    regrouping in addition

Prerequisites:
    place value
    addition within 30

Evidence needed:
    identify ones
    combine ones
    regroup 10 ones
    add tens
```

Then the generator produces a question that actually measures the intended skill.

---

# 15. Adaptive assessment becomes possible

Suppose:

```text
L26 → Carry Addition
```

Student fails 3 questions.

The system checks the graph:

```text
Carry Addition
       ↑
  Regrouping
       ↑
 Place Value
       ↑
Tens / Ones
```

It can then generate diagnostic questions:

```text
Q1: Identify tens and ones
Q2: Make 10 ones into 1 ten
Q3: Add 8 + 5 using objects
Q4: Add 18 + 7
Q5: Carry addition
```

This is much better than simply giving the student another carry-addition question.

---

# 16. How to build it in practice

## Phase 1 — Freeze the taxonomy

Create:

```text
27 levels
↓
~20 core skills
↓
~70 subskills
```

Do not start with hundreds of skills.

Keep the first version small.

---

## Phase 2 — Create a skill dictionary

For every skill define:

```text
skill_id
name
definition
domain
observable_behaviors
prerequisites
common_errors
question_types
```

---

## Phase 3 — Map every existing question

For each question:

```text
Question
↓
Level
↓
Core Skill
↓
Subskill
↓
Question Type
↓
Expected Evidence
```

This is where your existing FLN question bank becomes extremely valuable.

---

## Phase 4 — Build the prerequisite graph

Start manually.

Do not ask AI to automatically decide all prerequisites.

Have:

```text
Curriculum expert
+
research evidence
+
AI assistance
```

produce candidate relationships, then review them.

---

## Phase 5 — Generate questions from the graph

The generator receives:

```text
level
+
skill
+
subskill
+
question type
+
difficulty
+
representation
```

and generates the question.

---

## Phase 6 — Capture evidence

Every response should produce:

```text
correct/incorrect
+
skill
+
subskill
+
error type
+
representation
+
attempt number
```

---

## Phase 7 — Build student knowledge state

Eventually:

```text
                 Student
                    │
             ┌──────┴──────┐
             ↓             ↓
         Mastered       Needs Support
             │             │
             ↓             ↓
        Next Level      Prerequisite
                           ↓
                       Intervention
```

---

# 17. The key design principle

Do **not** build:

```text
L1 → L2 → L3 → L4 → ... → L27
```

as a simple ladder.

Build:

```text
                         L27
                       /  |  \
                     /    |    \
                  L26    L25    ...
                   |
              Regrouping
               /       \
         Place Value   Addition
             |            |
          Tens/Ones    L16
             |            |
             └─────┬──────┘
                   ↓
             Number Sense
                   ↓
               Counting
```

A child may therefore be:

```text
Counting              MASTERED
Comparison            MASTERED
Addition              DEVELOPING
Subtraction           DEVELOPING
Place Value            WEAK
```

There is no need to assign a single global "Math Level" to the child.

That is one of the biggest advantages of a **skill graph over a simple level system**.

---

# 18. Recommended final architecture

```text
                         FLN MATH KNOWLEDGE GRAPH

                              LEVELS
                           L1 ───── L27
                              │
                              ↓
                         CORE SKILLS
                              │
                              ↓
                        SUB-SKILLS
                              │
                 ┌────────────┼────────────┐
                 ↓            ↓            ↓
            PREREQUISITES  QUESTION     ERRORS
                            TYPES
                 │            │            │
                 └────────────┼────────────┘
                              ↓
                         STUDENT
                         EVIDENCE
                              ↓
                       MASTERY ESTIMATE
                              ↓
                  ┌───────────┴───────────┐
                  ↓                       ↓
             NEXT LEVEL              INTERVENTION
```

This architecture is strongly grounded in existing work, but the **specific FLN 27-level implementation would be your project's own model**.

The closest precedents are Learning Trajectories for developmental levels, NWEA's Learning Continuum for connecting assessment performance to instructional learning statements, ASSISTments/knowledge tracing for question → skill → student evidence, and learning-progression knowledge graphs for relationships between skills. citeturn0search1turn0search6turn0search16turn0search10

## 19. One important research finding for your design

There is particularly strong justification for keeping **counting, symbolic mapping/number relations, calculation, and patterning as separate but related skill families**. Longitudinal research found that by the end of first grade, symbolic mapping, calculation and patterning were important predictors of later mathematics achievement. citeturn0search3turn0search5

That supports the architecture we're proposing rather than treating "math" as one score.

---

## 20. Recommended next deliverable

For your actual FLN implementation, I would turn this into a **versioned specification**, for example:

```text
docs/
└── skill-graph/
    ├── README.md
    ├── taxonomy.md
    ├── levels.md
    ├── skills.md
    ├── subskills.md
    ├── prerequisites.md
    ├── question-types.md
    ├── evidence-model.md
    ├── mastery-model.md
    ├── level-skill-matrix.md
    └── diagrams/
        └── math-skill-graph.svg
```

The most important artifact should be `level-skill-matrix.md`: **L1–L27 × every core skill × subskill × prerequisite × question type × evidence**. Once that is correct, the MongoDB schema, question generator and adaptive assessment logic can all be derived from it.
