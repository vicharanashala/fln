# ALEKS Case Study — Key Points

> **Purpose:** Extract actionable lessons from ALEKS (Assessment and Learning in Knowledge Spaces) for application to the FLN platform.

---

## Table of Contents

- [1. What is ALEKS?](#1-what-is-aleks)
- [2. Problem Statement & Objectives](#2-problem-statement--objectives)
- [3. System Architecture Overview](#3-system-architecture-overview)
- [4. Adaptive Assessment Engine (9-Step Algorithm)](#4-adaptive-assessment-engine-9-step-algorithm)
- [5. Why 20–25 Questions Suffice](#5-why-20-25-questions-suffice)
- [6. Underlying Math Concepts](#6-underlying-math-concepts)
- [7. QuickTables — Cognitive Science for Fact Fluency](#7-quicktables--cognitive-science-for-fact-fluency)
- [8. Knowledge Tracing (KT) Models](#8-knowledge-tracing-kt-models)
- [9. Lessons Learned → FLN Platform](#9-lessons-learned--fln-platform)
- [10. Key Differences: ALEKS vs. FLN](#10-key-differences-aleks-vs-fln)
- [Quick Reference Card](#quick-reference-card)

---

## 1. What is ALEKS?

**ALEKS** is an AI-powered adaptive learning & assessment platform for STEM (math, chemistry, statistics). It continuously estimates each student's knowledge state and recommends the next appropriate learning objective.

- **Developed by:** New York University & UC Irvine (KST research)
- **Core philosophy:** No two students see the same question sequence
- **Typical assessment length:** 20–25 questions (vs. hundreds of skills in the syllabus)

---

## 2. Problem Statement & Objectives

| Problem | ALEKS Solution |
|---|---|
| Same curriculum for every student | Personalized question sequencing |
| One-size-fits-all assessments | Adaptive, real-time assessment |
| Marks ≠ conceptual mastery | Probabilistic knowledge tracing |
| Teachers can't identify individual gaps | Automated knowledge-state report |

**Key Objectives:**
1. Personalize learning
2. Identify each student's knowledge state
3. Recommend the next learnable concept
4. Reduce teacher workload
5. Improve learning retention
6. Support mastery-based education

---

## 3. System Architecture Overview

```
Knowledge State → Question → Response → Update → New Knowledge State
                         ↻ (until stable)
```

- Huge question bank — each question tagged with: **skill tested**, **difficulty**, **prerequisite skills**
- Each question is a **proxy for a skill** (e.g., "8 + 5 = ?" tests "Addition within 20")
- Confidence scores shift per skill after every answer: 50% → 80% → 95% → move on

---

## 4. Adaptive Assessment Engine (9-Step Algorithm)

| Step | What Happens |
|---|---|
| **1** | Build the Knowledge Space — experts define skills & prerequisites |
| **2** | Initialize student model — all valid knowledge states are possible |
| **3** | Ask first question — chosen to eliminate maximum states |
| **4** | Evaluate response — correctness, time, attempts |
| **5** | Update knowledge state — shrink set of possible states |
| **6** | Calculate uncertainty per skill — e.g., Counting 99%, Addition 52% |
| **7** | Pick next question from the **most uncertain** skill |
| **8** | Repeat loop until confidence is high enough |
| **9** | Output final knowledge profile → recommend next topics |

> **Key insight:** Questions target the skill with the most remaining ambiguity — not harder, not easier, just **most informative**.

### Pseudocode

```
Initialize possible states
while confidence < threshold:
    find most uncertain skill
    choose best question for it
    get student's answer
    update knowledge state
    eliminate impossible states
Output final knowledge profile → recommend next topics
```

---

## 5. Why 20–25 Questions Suffice

| Reason | Explanation |
|---|---|
| **Skill dependencies** | Mastering advanced skills implies mastery of prerequisites (e.g., correct subtraction confirms number recognition, counting, comparison, addition) |
| **Smart question selection** | Each question maximises new information |
| **Knowledge Space Theory** | Rules out "impossible" states (e.g., knowing Subtraction without Addition) — 2⁵⁰⁰ states collapses to a feasible set |

**The narrowing funnel:**
- Start: millions of possible knowledge states
- After 1 answer: hundreds
- After 2–3 answers: handful
- At 20–25 questions: confident estimate

---

## 6. Underlying Math Concepts

| Concept | Role in ALEKS |
|---|---|
| **Knowledge Space Theory** | Defines which knowledge states are feasible |
| **Learning Spaces** | Keeps skill progressions logically valid |
| **Graph Theory** | Models prerequisite relationships between skills |
| **Combinatorics** | Handles the combinatoric explosion of 2⁵⁰⁰ states |
| **Probability** | Represents uncertainty about what the student knows |
| **Information Theory** | Guides which question yields the most information |
| **Stochastic Processes** | Models how knowledge changes over time |

---

## 7. QuickTables — Cognitive Science for Fact Fluency

**What it is:** An ALEKS component that builds automatic recall of basic math facts using 6 learning-science principles.

| Principle | Description |
|---|---|
| **Retrieval Practice** | Recall from memory ("7 + 5 = ?"), not recognition |
| **Interleaved Practice** | Mix +, -, ×, ÷ in one session (not blocked) |
| **Distributed Practice** | Increasing intervals: Day 1 → 2 → 5 → 10 → 20 |
| **Memory Stacks Algorithm** | Correct answers move up stacks (longer intervals); incorrect drop down |
| **Mastery-Based Learning** | Move on when consistent, not after fixed reps |
| **Intrinsic Motivation** | Educational games unlocked by demonstrated mastery |

**Cycle:**
```
Practice → Retrieval → Adaptive Scheduling → Interleaving → Spaced Review
→ Retention → Automatic Recall → Unlock Games → Continue Practice
```

---

## 8. Knowledge Tracing (KT) Models

> KT models track mastery as an **evolving probability over time** — different from KST which maps feasible states.

| Model | Core Idea | Strengths | Weaknesses |
|---|---|---|---|
| **BKT** | 4 params per skill (guess, slip, learn, prior); Bayesian updates | Interpretable, small data, efficient | Assumes skills independent |
| **DKT** | LSTM neural nets on interaction sequences | Captures complex patterns, large-scale | Needs lots of data, uninterpretable |
| **SAKT** | Transformer self-attention — weighs relevant past interactions | Long-range dependencies, efficient | Ignores difficulty, needs big data |
| **AKT** | SAKT + question difficulty & skill embeddings | More accurate, personalised | Computationally expensive |
| **GKT** | Skills as nodes in prerequisite graph; updates propagate to connected skills | Curriculum-aware, explainable | Requires accurate prerequisite graph |

**Trend:** Simple/interpretable (BKT) → complex/data-hungry (DKT, SAKT, AKT) → structured/explainable but graph-dependent (GKT).

---

## 9. Lessons Learned → FLN Platform

| # | ALEKS Principle | FLN Application |
|---|---|---|
| **1** | Assess the skill graph, not isolated questions | FLN curricula already map questions → competencies; next step is encoding prerequisite relationships explicitly |
| **2** | Confidence-based stopping vs. fixed-length tests | FLN uses fixed-length (Baseline/Mid/End-Year) — deliberate for paper-based national scale; adaptive length is out of scope |
| **3** | Probabilistic mastery inference (not binary pass/fail) | FLN's AI updates FLN level each cycle (not gating on individual tests) — a direct KST adoption |
| **4** | Auto-flag weak content | FLN rule: if 50%+ fail an "easy"-tagged question, auto-flag for review |
| **5** | Personalized worksheets = "next learnable concept" | FLN's AI generates worksheets per student's latest FLN level |

### QuickTables → FLN Numeracy Practice

| QuickTables Principle | FLN Application |
|---|---|
| Retrieval Practice | Worksheet questions ask for recall, not just MC recognition |
| Interleaved Practice | Worksheets mix competencies across current + prior FLN levels |
| Distributed Practice | Baseline/Mid/End-Year re-test prior-class syllabus at spaced intervals |
| Memory Stacks | *(Future)* Persistently weak competencies weighted more heavily |
| Mastery-Based Progression | Already implemented — FLN levels are mastery-driven |
| Intrinsic Motivation | *(Future)* Badges/certificates tied to competency milestones |

---

## 10. Key Differences: ALEKS vs. FLN

| Dimension | ALEKS | FLN Platform |
|---|---|---|
| **Scale** | Single-student, continuous, online | National-scale, multi-role, offline-capable |
| **Delivery** | Fully digital, real-time adaptive | Printed paper + ICR scanning, fixed-cycle |
| **Adaptivity** | Within-session (every question) | Between-cycles (worksheet per latest level) |
| **Assessment length** | Variable (20–25 questions) | Fixed-syllabus (Baseline/Mid/End-Year) |
| **Architecture** | Online-only | Offline-first with print/exam windows |

> **Future opportunity:** Digital/tablet delivery or a two-stage design (short adaptive digital diagnostic + paper mass assessment) — both are larger architectural changes beyond current scope.

---

## Quick Reference Card

```
ALEKS at a Glance
├── What: AI adaptive assessment & learning (STEM)
├── Core: Knowledge Space Theory + prerequisite graphs
├── Assessment: 20-25 questions, stopping at confidence
├── Question selection: Most informative, not hardest/easiest
├── QuickTables: Retrieval + interleaving + spaced repetition
└── Key output: Knowledge profile → next learnable concept
```
