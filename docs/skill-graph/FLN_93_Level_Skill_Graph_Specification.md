# FLN 93-Level → Skill Graph Specification

## Purpose

This document extends the 27-level approach to the complete **93-level FLN mathematics progression**.

Core principle:

> A level is an assessment/learning checkpoint. A skill is the underlying mathematical capability.

Therefore, if a child fails a level, the system should inspect the skills represented by that level and identify which underlying skill(s) may be weak.

```text
93 Levels
    ↓
Core Mathematical Skills
    ↓
Granular Subskills
    ↓
Prerequisite / Supporting Relationships
    ↓
Question Types
    ↓
Student Evidence
    ↓
Skill Mastery / Skill Gaps
    ↓
Next Level / Diagnostic Questions / Intervention
```

## 1. Research basis

This architecture is strongly consistent with established mathematics-learning research, while the specific 93-level implementation is the project's own operational model.

### Learning Trajectories

Clements and Sarama's Learning Trajectories framework describes mathematics learning through a mathematical goal, a developmental path containing levels of thinking, and instructional activities matched to those levels. It explicitly treats levels as developmental benchmarks rather than absolute stages.

Sources:
- https://www.learningtrajectories.org/
- https://www.learningtrajectories.org/lt-resources/learning-trajectories

### NIPUN Bharat

NIPUN Bharat identifies foundational mathematics around pre-number concepts, numbers and operations, shapes and spatial understanding, measurement, patterns, data handling and mathematical communication. It also emphasizes quantities, more/less, number-symbol relationships, comparison, ordering and spatial understanding.

Source:
https://www.education.gov.in/sites/upload_files/mhrd/files/nipun_bharat_eng1.pdf

### Foundational Stage competencies

The Foundational Stage competency framework includes number sense, operations, one-to-one correspondence, measurement, shapes, data handling, patterns and calendar activities.

Source:
https://ssa.megeducation.gov.in/Document/Publications/Final_FS_Key_Competencies_%26_Learning_Outcomes_10.6.23.pdf

### Foundational Learning Study

The Government of India's Foundational Learning Study assessed foundational numeracy including number identification and comparison, number operations, multiplication/division facts, measurement, fractions, patterns and data handling.

Source:
https://nipunbharat.education.gov.in/fls/fls.aspx

### Fine-grained early numeracy trajectories

Research involving 801 preschool children examined item-level development across eight numeracy subtests and found clear developmental trajectories.

Source:
https://doi.org/10.1016/j.jecp.2020.104846

## 2. Core skill taxonomy

Use approximately **24 core skills**:

| ID | Core skill | Main area |
|---|---|---|
| SK01 | One-to-One Correspondence | Pre-number |
| SK02 | Classification | Pre-number |
| SK03 | Seriation & Ordering | Pre-number |
| SK04 | Same/Different & Attribute Recognition | Pre-number |
| SK05 | Counting & Counting Sequence | Number Sense |
| SK06 | Cardinality | Number Sense |
| SK07 | Subitizing | Number Sense |
| SK08 | Quantity & Numeral Representation | Number Sense |
| SK09 | Number Comparison | Number Sense |
| SK10 | Number Sequencing & Number Line | Number Sense |
| SK11 | Place Value & Base-Ten Structure | Number Sense |
| SK12 | Number Composition & Decomposition | Number Sense |
| SK13 | Addition | Number Operations |
| SK14 | Subtraction | Number Operations |
| SK15 | Multiplication | Number Operations |
| SK16 | Division | Number Operations |
| SK17 | Fractions | Fractions |
| SK18 | Patterns & Generalization | Patterns |
| SK19 | Shapes & Spatial Reasoning | Shapes & Spatial |
| SK20 | Measurement | Measurement |
| SK21 | Time & Calendar | Calendar & Time |
| SK22 | Money | Money |
| SK23 | Data Handling | Data |
| SK24 | Mathematical Reasoning & Problem Solving | Cross-cutting |

## 3. Granular subskills

### SK01 — One-to-One Correspondence
- SK01.01 Match one object to one object
- SK01.02 Match objects across two groups
- SK01.03 Maintain one-to-one correspondence while counting
- SK01.04 Identify unmatched objects

### SK02 — Classification
- SK02.01 Classify by one property
- SK02.02 Identify common property
- SK02.03 Identify odd object
- SK02.04 Classify by multiple properties
- SK02.05 Flexible reclassification

### SK03 — Seriation & Ordering
- SK03.01 Arrange three objects by size
- SK03.02 Arrange objects by length
- SK03.03 Use comparative relationships
- SK03.04 Apply transitivity
- SK03.05 Order numerals
- SK03.06 Order numbers ascending
- SK03.07 Order numbers descending

### SK04 — Same/Different & Attribute Recognition
- SK04.01 Perceptual same/different
- SK04.02 Identify visual attributes
- SK04.03 Identify shape attributes
- SK04.04 Identify object differences

### SK05 — Counting & Counting Sequence
- SK05.01 Rote counting to 10
- SK05.02 Count objects 1–3
- SK05.03 Count to 5
- SK05.04 Count to 10
- SK05.05 Count to 20
- SK05.06 Count to 50
- SK05.07 Count to 100
- SK05.08 Count forward from a given number
- SK05.09 Count backward

### SK06 — Cardinality
- SK06.01 Understand last number counted as total
- SK06.02 Count small sets
- SK06.03 Count and tell how many
- SK06.04 Relate quantity to numeral

### SK07 — Subitizing
- SK07.01 Perceptual subitizing
- SK07.02 Recognize small quantity without counting
- SK07.03 Conceptual subitizing
- SK07.04 Compose quantity from subgroups

### SK08 — Quantity & Numeral Representation
- SK08.01 Recognize numerals 1–10
- SK08.02 Match numeral to quantity
- SK08.03 Represent quantity with objects
- SK08.04 Read numerals
- SK08.05 Write numerals
- SK08.06 Read/write numbers to 99
- SK08.07 Read/write three-digit numbers
- SK08.08 Read/write four-digit numbers

### SK09 — Number Comparison
- SK09.01 Compare quantities
- SK09.02 More/less/equal
- SK09.03 Compare numerals using objects
- SK09.04 Abstract numeral comparison
- SK09.05 Compare close numbers
- SK09.06 Compare two-digit numbers
- SK09.07 Compare three-digit numbers

### SK10 — Number Sequencing & Number Line
- SK10.01 Numeral sequencing
- SK10.02 Before
- SK10.03 After
- SK10.04 Between
- SK10.05 Missing number
- SK10.06 Ordinal position
- SK10.07 Informal number line 0–20
- SK10.08 Number line 0–100

### SK11 — Place Value & Base-Ten Structure
- SK11.01 Understand groups of ten
- SK11.02 Tens and ones
- SK11.03 Tens as bundles
- SK11.04 Zero as placeholder
- SK11.05 Two-digit place value
- SK11.06 Three-digit place value
- SK11.07 Expanded form
- SK11.08 Four-digit place value
- SK11.09 Five-digit place value

### SK12 — Number Composition & Decomposition
- SK12.01 Compose quantities
- SK12.02 Decompose quantities
- SK12.03 Flexible two-digit decomposition
- SK12.04 Flexible three-digit decomposition
- SK12.05 Expanded form
- SK12.06 Regroup quantities

### SK13 — Addition
- SK13.01 Combine sets
- SK13.02 Concrete addition
- SK13.03 Single-digit addition
- SK13.04 Addition within 20
- SK13.05 Addition within 30
- SK13.06 Two-digit addition
- SK13.07 Addition with regrouping
- SK13.08 Three-digit addition
- SK13.09 Multi-digit addition
- SK13.10 Addition word problems

### SK14 — Subtraction
- SK14.01 Take away
- SK14.02 Concrete subtraction
- SK14.03 Single-digit subtraction
- SK14.04 Subtraction within 20
- SK14.05 Subtraction within 30
- SK14.06 Two-digit subtraction
- SK14.07 Subtraction with regrouping
- SK14.08 Three-digit subtraction
- SK14.09 Multi-digit subtraction
- SK14.10 Subtraction word problems

### SK15 — Multiplication
- SK15.01 Equal groups
- SK15.02 Repeated addition
- SK15.03 Skip-count connection
- SK15.04 Multiplication facts 2,3,4,5,10
- SK15.05 Tables 2–10
- SK15.06 Multi-digit multiplication
- SK15.07 Multiplication word problems

### SK16 — Division
- SK16.01 Equal sharing
- SK16.02 Equal grouping
- SK16.03 Division facts
- SK16.04 Relation to multiplication
- SK16.05 Division procedures
- SK16.06 Long division
- SK16.07 Division word problems

### SK17 — Fractions
- SK17.01 Equal parts
- SK17.02 Half
- SK17.03 Quarter
- SK17.04 Fraction notation
- SK17.05 Equivalent fractions

### SK18 — Patterns & Generalization
- SK18.01 Identify repeating pattern
- SK18.02 Extend pattern
- SK18.03 Copy pattern
- SK18.04 Two-item pattern
- SK18.05 Three-item pattern
- SK18.06 Number pattern
- SK18.07 Skip-count pattern
- SK18.08 Identify pattern rule
- SK18.09 Generalize pattern
- SK18.10 Advanced number pattern

### SK19 — Shapes & Spatial Reasoning
- SK19.01 Shape matching
- SK19.02 Identify basic shapes
- SK19.03 Identify shape properties
- SK19.04 Compose shapes
- SK19.05 Decompose shapes
- SK19.06 Identify 2D shapes
- SK19.07 Identify 3D shapes
- SK19.08 Spatial vocabulary
- SK19.09 Relate 2D faces to 3D solids
- SK19.10 Nets
- SK19.11 Perspective
- SK19.12 Angles and turns
- SK19.13 Symmetry
- SK19.14 Reflection

### SK20 — Measurement
- SK20.01 Compare length
- SK20.02 Compare size
- SK20.03 Compare capacity
- SK20.04 Estimate length
- SK20.05 Estimate capacity
- SK20.06 Use non-standard units
- SK20.07 Use uniform units
- SK20.08 Standard measurement units
- SK20.09 Unit conversion
- SK20.10 Applied measurement
- SK20.11 Perimeter
- SK20.12 Area

### SK21 — Time & Calendar
- SK21.01 Day/night concepts
- SK21.02 Calendar structure
- SK21.03 Days/weeks/months
- SK21.04 Read calendar
- SK21.05 Tell time to hour
- SK21.06 Tell time to half-hour
- SK21.07 Calculate elapsed time
- SK21.08 Advanced time problems

### SK22 — Money
- SK22.01 Recognize currency
- SK22.02 Match currency to value
- SK22.03 Combine amounts
- SK22.04 Calculate total cost
- SK22.05 Calculate change
- SK22.06 Multi-step money problems

### SK23 — Data Handling
- SK23.01 Sort data
- SK23.02 Classify data
- SK23.03 Tally
- SK23.04 Count categories
- SK23.05 Read pictograph
- SK23.06 Read bar graph
- SK23.07 Compare data
- SK23.08 Interpret data

### SK24 — Mathematical Reasoning & Problem Solving
- SK24.01 Identify relevant information
- SK24.02 Choose an operation
- SK24.03 Represent a problem
- SK24.04 Explain reasoning
- SK24.05 Check an answer
- SK24.06 Apply mathematics to daily life
- SK24.07 Solve multi-step problems

SK24 is cross-cutting and should be attached to appropriate problems across all strands.

# 4. Level → skill mapping

| Level | Capability | Primary skill(s) | Supporting skills |
|---:|---|---|---|
| 1 | One-to-One Correspondence | SK01 | SK06 |
| 2 | Classification (Single Property) | SK02 | SK04 |
| 3 | Perceptual Same/Different | SK04 | SK02 |
| 4 | Rote Verbal Counting to 10 | SK05 | SK10 |
| 5 | Counting Small Sets (1–3) | SK05, SK06 | SK01 |
| 6 | Shape Matching | SK19 | SK04 |
| 7 | Perceptual Subitizing | SK07 | SK06 |
| 8 | Quantity Comparison | SK09 | SK01, SK06 |
| 9 | Seriation (3 Objects) | SK03 | SK09 |
| 10 | Classification (Increasing Complexity) | SK02 | SK04 |
| 11 | Counting to 5 (Cardinality) | SK05, SK06 | SK01 |
| 12 | Counting 6–10 | SK05 | SK06 |
| 13 | Shape Identification | SK19 | SK04 |
| 14 | 2-Item Patterns | SK18 | SK04 |
| 15 | Comparative Vocabulary | SK20 | SK09 |
| 16 | Conceptual Subitizing | SK07 | SK06, SK12 |
| 17 | Basic Shape Composition | SK19 | SK12 |
| 18 | Numeral Recognition 1–10 | SK08 | SK05 |
| 19 | Numeral-Quantity Correspondence | SK08, SK06 | SK05 |
| 20 | Numeral Comparison (Object-Mediated) | SK09 | SK08 |
| 21 | Seriation with Transitivity | SK03 | SK09 |
| 22 | Flexible Classification | SK02 | SK04, SK24 |
| 23 | Numeral Sequencing | SK10 | SK05, SK08 |
| 24 | Comparative Vocabulary Formalizing | SK20 | SK09 |
| 25 | Patterns 2-Item / 3-Item | SK18 | SK04 |
| 26 | Basic Shape Properties | SK19 | SK04 |
| 27 | Shape Composition & Decomposition | SK19 | SK12 |
| 28 | Abstract Numeral Comparison | SK09 | SK08, SK10 |
| 29 | Close Numeral Comparison | SK09 | SK11 |
| 30 | Counting Objects to 20 | SK05, SK06 | SK01 |
| 31 | Reading/Writing Numerals to 99 | SK08 | SK05, SK11 |
| 32 | Tens and Ones | SK11 | SK12 |
| 33 | Single-Digit Addition | SK13 | SK05, SK06, SK12 |
| 34 | Single-Digit Subtraction | SK14 | SK05, SK06 |
| 35 | 3D Shape Properties | SK19 | SK04 |
| 36 | Non-Standard Length Estimation | SK20 | SK24 |
| 37 | Non-Standard Capacity Estimation | SK20 | SK24 |
| 38 | 3-Item Pattern Completion | SK18 | SK04 |
| 39 | Concept of Zero | SK08 | SK05, SK11 |
| 40 | Ordinal Positions | SK10 | SK05 |
| 41 | Informal Number Line 0–20 | SK10 | SK09 |
| 42 | Advanced Shape Composition | SK19 | SK12 |
| 43 | Reading/Writing 3-Digit Numbers | SK08 | SK11 |
| 44 | Tens as Bundles/Groups | SK11 | SK12 |
| 45 | Flexible 2-Digit Decomposition | SK12 | SK11 |
| 46 | 2-Digit Addition with Regrouping | SK13, SK11 | SK12 |
| 47 | 2-Digit Subtraction with Regrouping | SK14, SK11 | SK12 |
| 48 | Multiplication as Repeated Addition | SK15 | SK13, SK18 |
| 49 | Division as Equal Sharing | SK16 | SK01, SK06 |
| 50 | Tables 2,3,4,5,10 | SK15 | SK18 |
| 51 | Currency Recognition | SK22 | SK08 |
| 52 | Informal Fractions | SK17 | SK19 |
| 53 | Uniform Non-Standard Measurement | SK20 | SK24 |
| 54 | 2D Shape Set Identification | SK19 | SK02 |
| 55 | Spatial Vocabulary | SK19 | SK24 |
| 56 | Calendar Reading | SK21 | SK10 |
| 57 | Sorting & Tallies | SK23 | SK02, SK05 |
| 58 | Number Patterns & Sequences | SK18 | SK10 |
| 59 | Zero as Placeholder | SK11 | SK08 |
| 60 | Extended Number Line 0–100 | SK10 | SK09, SK11 |
| 61 | Skip Counting 2s,5s,10s | SK18, SK15 | SK05 |
| 62 | 3-Digit Place Value & Expanded Form | SK11 | SK12 |
| 63 | Flexible 3-Digit Decomposition | SK12 | SK11 |
| 64 | 3-Digit Comparison & Ordering | SK09, SK03 | SK11 |
| 65 | Reading/Writing 4-Digit Numbers | SK08 | SK11 |
| 66 | 3-Digit Addition & Subtraction | SK13, SK14 | SK11, SK12 |
| 67 | Multiplication Tables 2–10 | SK15 | SK18 |
| 68 | Division Facts & Inverse Relation | SK16 | SK15 |
| 69 | Standard Measurement Units | SK20 | SK24 |
| 70 | 2D Faces / 3D Solids | SK19 | SK04 |
| 71 | Time Hours & Half-Hours | SK21 | SK10 |
| 72 | Money Arithmetic | SK22 | SK13, SK14 |
| 73 | Formal Fractions Half/Quarter | SK17 | SK12 |
| 74 | Pattern Rules & Generalization | SK18 | SK24 |
| 75 | Pictographs & Bar Graphs | SK23 | SK05, SK09 |
| 76 | 4/5-Digit Place Value | SK11 | SK12 |
| 77 | Large Number Operations & Regrouping | SK13, SK14, SK11 | SK12 |
| 78 | Complex Multi-Digit Word Problems | SK24, SK13, SK14 | SK11, SK12 |
| 79 | Extended Multiplication | SK15 | SK11, SK12 |
| 80 | Formal Long Division | SK16 | SK15, SK11 |
| 81 | Fraction Notation & Equivalence | SK17 | SK12 |
| 82 | Standard Unit Conversion | SK20 | SK12 |
| 83 | Applied Measurement Word Problems | SK20, SK24 | SK13, SK14 |
| 84 | 3D Nets & Spatial Perspective | SK19 | SK12, SK24 |
| 85 | Advanced Time Calculation | SK21 | SK13, SK14 |
| 86 | Complex Money Problems | SK22, SK24 | SK13, SK14 |
| 87 | Advanced Number Patterns | SK18 | SK10, SK24 |
| 88 | Bar Graphs & Data Interpretation | SK23 | SK09, SK24 |
| 89 | Factors & Multiples | SK15, SK18 | SK16 |
| 90 | Decimals Tenths/Hundredths | SK08, SK17 | SK11, SK12 |
| 91 | Angles & Turn | SK19 | SK10 |
| 92 | Symmetry & Reflection | SK19 | SK18 |
| 93 | Perimeter & Area | SK20 | SK19, SK13 |

# 5. Why this should not be a simple 93-level ladder

Do not model the child only as:

```text
L1 → L2 → L3 → ... → L93
```

Instead:

```text
                 MATHEMATICS
                      |
        ┌─────────────┼──────────────┐
        ↓             ↓              ↓
   Number Sense   Operations      Geometry
        ↓             ↓              ↓
      skills        skills         skills
        ↓             ↓              ↓
    subskills      subskills      subskills
```

The 93 levels are checkpoints through these connected skill trajectories.

# 6. Failure diagnosis

Example:

```text
Student fails L46
2-Digit Addition with Regrouping
```

L46 is connected to:

```text
SK13 Addition
SK11 Place Value
SK12 Composition/Decomposition
```

The system should diagnose rather than simply label "addition weak":

```text
Q1: 7 + 5
Q2: 18 + 7
Q3: Identify tens and ones in 27
Q4: Make 10 ones into 1 ten
Q5: 27 + 18
```

Possible result:

```text
Addition:            MASTERED
Place Value:         MASTERED
Regrouping:          WEAK
```

The intervention then targets regrouping.

# 7. Another diagnostic example

Suppose a child fails:

```text
L64 — 3-Digit Comparison & Ordering
```

The system sees:

```text
Primary:
    Number Comparison
    Number Ordering

Supporting:
    Place Value
```

Historical evidence:

```text
L28 comparison       ✓
L29 close comparison ✓
L43 3-digit numbers  ✓
L62 place value      ✗
L64 comparison       ✗
```

The likely weakness is therefore **3-digit place value**, not necessarily generic comparison.

Diagnostic questions can be:

```text
Q1: What is the hundreds digit in 472?
Q2: Which is greater: 472 or 427?
Q3: Which is greater: 508 or 580?
Q4: Order 472, 427, 482.
```

# 8. Student evidence model

Every question response should produce evidence against one or more subskills.

```json
{
  "studentId": "S001",
  "questionId": "Q046_012",
  "levelId": "L46",
  "evidence": [
    {
      "skillId": "SK13",
      "subskillId": "SK13.07",
      "result": "correct"
    },
    {
      "skillId": "SK11",
      "subskillId": "SK11.02",
      "result": "correct"
    },
    {
      "skillId": "SK12",
      "subskillId": "SK12.06",
      "result": "incorrect",
      "errorType": "failed_regrouping"
    }
  ]
}
```

# 9. Question metadata

Every question should contain:

```text
question_id
level_id
primary_skill
secondary_skills
subskills
question_type
difficulty
representation
expected_evidence
error_types
```

Example:

```json
{
  "questionId": "Q46_001",
  "levelId": "L46",
  "primarySkill": "SK13",
  "secondarySkills": ["SK11", "SK12"],
  "subskills": ["SK13.07", "SK11.02", "SK12.06"],
  "questionType": "two_digit_addition_regrouping",
  "expectedEvidence": [
    "adds_ones",
    "recognizes_10_ones",
    "regroups_to_ten",
    "adds_tens"
  ]
}
```

# 10. Primary vs supporting skill

Each level/question should distinguish:

**Primary skill:** the capability the level is designed to assess.

**Supporting skill:** a capability required to perform the task but not necessarily the learning target.

Example:

```text
L46 — 2-Digit Addition with Regrouping

Primary:
    Addition

Supporting:
    Place Value
    Decomposition
```

This prevents over-diagnosing a child.

# 11. Prerequisite/support graph

Use relationships rather than a rigid ladder.

```text
One-to-One Correspondence
        ↓ supports
Counting
        ↓ supports
Cardinality
        ↓ supports
Numeral Representation
        ↓ supports
Number Comparison
        ↓ supports
Number Ordering
        ↓ supports
Place Value
        ↓ supports
Composition / Decomposition
        ↓
    ┌───┴────┐
    ↓        ↓
 Addition  Subtraction
    ↓        ↓
 Regrouping / Algorithms
```

Multiplication:

```text
Counting
   ↓
Skip Counting
   ↓
Equal Groups
   ↓
Repeated Addition
   ↓
Multiplication
   ↓
Multiplication Facts
   ↓
Extended Multiplication
```

Division:

```text
Equal Sharing
      ↓
Equal Groups
      ↓
Division
      ↓
Division Facts
      ↓
Multiplication ↔ Division
      ↓
Formal Division
```

Geometry:

```text
Shape Recognition
      ↓
Shape Properties
      ↓
Composition / Decomposition
      ↓
Spatial Relationships
      ↓
Nets / Perspective
      ↓
Angles / Symmetry
```

Measurement:

```text
Comparison
    ↓
Non-standard Units
    ↓
Uniform Units
    ↓
Standard Units
    ↓
Unit Conversion
    ↓
Applied Measurement
    ↓
Perimeter / Area
```

# 12. Skill progression across grades

A skill can appear repeatedly across levels.

### Number Comparison

```text
L8  Quantity Comparison
 ↓
L20 Object-mediated numeral comparison
 ↓
L28 Abstract numeral comparison
 ↓
L29 Close numeral comparison
 ↓
L64 3-digit comparison
```

### Place Value

```text
L32 Tens & Ones
 ↓
L44 Tens as Groups
 ↓
L59 Zero Placeholder
 ↓
L62 3-digit Place Value
 ↓
L76 4/5-digit Place Value
```

### Patterns

```text
L14 2-item patterns
 ↓
L25 2/3-item patterns
 ↓
L38 3-item completion
 ↓
L58 number patterns
 ↓
L74 pattern rules/generalization
 ↓
L87 advanced patterns
```

### Shapes

```text
L6 Shape Matching
 ↓
L13 Shape Identification
 ↓
L26 Shape Properties
 ↓
L27 Composition/Decomposition
 ↓
L35 3D Properties
 ↓
L42 Advanced Composition
 ↓
L70 2D faces / 3D solids
 ↓
L84 Nets / Perspective
 ↓
L91 Angles
 ↓
L92 Symmetry
```

# 13. Student skill profile

The dashboard should eventually show a skill profile rather than only a level score.

```text
Number Sense       88%
Operations         72%
Geometry           80%
Measurement        61%
Patterns           91%
Data               52%
```

Then drill down:

```text
Operations
   |
   +-- Addition       91%
   +-- Subtraction    84%
   +-- Multiplication 68%
   +-- Division       47%
```

And further:

```text
Division
   |
   +-- Equal Sharing       91%
   +-- Division Facts      53%
   +-- Inverse Relation    42%
   +-- Long Division       28%
```

These percentages should eventually come from a defined mastery model; they should not be arbitrary.

# 14. Do not calculate mastery from one failed level

Bad:

```text
Failed L80
→ Division = weak
```

Better:

```text
Failed L80
        ↓
Identify component skills
        ↓
Look at previous evidence
        ↓
Check prerequisite skills
        ↓
Generate diagnostic questions
        ↓
Update evidence
        ↓
Estimate mastery
```

# 15. Initial mastery states

Use three/four interpretable states:

```text
MASTERED
DEVELOPING
NEEDS_SUPPORT
INSUFFICIENT_EVIDENCE
```

Avoid false precision until sufficient evidence exists.

# 16. Recommended MongoDB collections

```text
levels
skills
subskills
skill_relationships
level_skill_map
question_types
questions
student_attempts
skill_evidence
student_skill_state
```

### levels

```json
{
  "levelId": "L46",
  "sequence": 46,
  "name": "2-Digit Addition with Regrouping",
  "grade": "Class 2"
}
```

### skills

```json
{
  "skillId": "SK13",
  "name": "Addition",
  "domain": "Number Operations"
}
```

### subskills

```json
{
  "subskillId": "SK13.07",
  "skillId": "SK13",
  "name": "Addition with regrouping",
  "observable": true
}
```

### level_skill_map

```json
{
  "levelId": "L46",
  "skills": [
    {
      "skillId": "SK13",
      "role": "primary",
      "weight": 0.50
    },
    {
      "skillId": "SK11",
      "role": "supporting",
      "weight": 0.25
    },
    {
      "skillId": "SK12",
      "role": "supporting",
      "weight": 0.25
    }
  ]
}
```

### skill_relationships

```json
{
  "fromSkill": "SK11",
  "toSkill": "SK13",
  "relationship": "supports"
}
```

# 17. Error taxonomy

Do not only record `incorrect`.

### Number sense

```text
more_less_confusion
numeral_quantity_mismatch
sequence_error
place_value_error
zero_placeholder_error
```

### Addition

```text
counting_error
operation_selection_error
ones_column_error
regrouping_error
carry_omission
```

### Subtraction

```text
take_away_concept_error
counting_back_error
ones_column_error
borrow_omission
regrouping_error
```

### Geometry

```text
shape_identification_error
property_error
orientation_error
spatial_vocabulary_error
```

### Measurement

```text
unit_selection_error
estimation_error
conversion_error
```

# 18. Assessment logic

The correct conceptual flow is:

```text
                  LEVEL
                    ↓
              OBSERVED TASK
                    ↓
          ┌─────────┴─────────┐
          ↓                   ↓
      Primary Skill       Supporting Skills
          ↓                   ↓
      Subskills          Prerequisites
          └─────────┬─────────┘
                    ↓
             Student Evidence
                    ↓
             Skill Hypothesis
                    ↓
          Diagnostic Assessment
                    ↓
              Skill State
                    ↓
              Intervention
```

A level failure is **evidence, not a diagnosis**.

# 19. Implementation roadmap

## Phase 1 — Taxonomy

Freeze:

```text
93 levels
24 core skills
~100 granular subskills
```

## Phase 2 — Mapping

For every level define:

```text
primary skill
supporting skills
subskills
prerequisites
question types
common errors
```

## Phase 3 — Question bank

Every question receives:

```text
level
primary skill
subskills
difficulty
question type
expected evidence
error taxonomy
```

## Phase 4 — Evidence

Store every student attempt.

## Phase 5 — Skill state

Initially use:

```text
mastered
developing
needs_support
insufficient_evidence
```

## Phase 6 — Diagnostic engine

When a level is failed:

```text
find connected skills
↓
inspect historical evidence
↓
find weak prerequisites
↓
generate diagnostic questions
↓
update evidence
```

## Phase 7 — Adaptive progression

```text
Student Skill Graph
       ↓
Identify weakest prerequisite
       ↓
Generate targeted practice
       ↓
Reassess
       ↓
Update skill state
       ↓
Recommend next level
```

# 20. Final architecture

```text
                        FLN MATHEMATICS

                         93 LEVELS
                            │
                            ↓
                     LEVEL-SKILL MAP
                            │
              ┌─────────────┼──────────────┐
              ↓             ↓              ↓
         CORE SKILLS    SUBSKILLS    RELATIONSHIPS
              │             │              │
              └─────────────┼──────────────┘
                            ↓
                        QUESTIONS
                            │
                            ↓
                    STUDENT RESPONSES
                            │
                            ↓
                       EVIDENCE
                            │
                            ↓
                    SKILL MASTERY STATE
                            │
                  ┌─────────┴─────────┐
                  ↓                   ↓
             NEXT LEVEL          DIAGNOSTIC
                                   TEST
                                      ↓
                                INTERVENTION
```

## Final principle

```text
LEVEL = where the child is being assessed

SKILL = what mathematical capability is being assessed

SUBSKILL = what specific behavior is being observed

EVIDENCE = what the child's response tells us

MASTERY = what we currently believe the child can do
```

The **93 levels remain the curricular spine**.

The **skill graph becomes the diagnostic intelligence layer**.

The most important implementation artifact should be:

```text
level-skill-matrix.md
```

It should become the single source of truth for the question bank, assessment engine, student dashboard and future adaptive-learning logic.
