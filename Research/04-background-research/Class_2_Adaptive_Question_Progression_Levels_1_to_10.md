# Observed Adaptive Mathematics Question Progression – Class 2
## Full Comparative Report: Struggling Path vs. Brilliant-Child Path, and the Derived Adaptive Algorithm

---

# 1. Executive Summary

This report combines **two separately observed performance sessions** on the same Class 2 adaptive mathematics module (Levels 1–10) and uses the differences between them to reconstruct **how the system selects and sequences questions**.

- **Session A ("Struggling Path"):** A session in which many answers were incorrect. Accuracy was explicitly displayed and fell from 48% (Level 1) to 42% (Level 2) to 4% (Level 3).
- **Session B ("Brilliant-Child Path"):** A session in which every answer was correct throughout all 10 levels.

**What changes between the two sessions is the core evidence for the algorithm.** When a wrong answer occurs in Session A, the system does three consistent things: (1) it logs the mistake, (2) it immediately re-serves a similar or easier-format version of the same skill, and (3) it queues the missed question for a mandatory sequential "Previous Mistakes – Review Phase" at the end of the level. None of this occurs in Session B — the on-screen rule explicitly states *"No repeated review phase when all answers are correct,"* and correct streaks instead lead to progressively more open-ended "Hard Exercise" questions at the end of each level.

**Levels 4 and 10 behave differently from the other levels in both sessions.** Level 4 is a fixed, timed, volume-based addition drill (not a mistake-branching level) in both sessions. Level 10 differs between the two sessions: Session A documents it as a generic, continuous timed matching-game description, while Session B documents an itemized, roman-numeral subtraction sequence with a Hard Exercise block — this inconsistency is noted explicitly rather than resolved by assumption.

**Overall conclusion:** The system is best described as a **mistake-driven remediation and mastery-gating engine**, not a probability-based adaptive testing algorithm. It does not appear to calculate a hidden ability score and select a statistically calibrated next question (as an Item Response Theory/CAT system would). Instead, it follows an observable, rule-like pattern: correct → advance and escalate; incorrect → simplify, repeat, and queue for review. This conclusion is an **analytical interpretation** drawn from comparing the two observed paths, not a confirmed specification of the system's internal code.

---

# 2. Observation Methodology

- **Class:** 2
- **Levels observed:** 1–10, in both sessions
- **Session A profile:** Struggling-student path — many incorrect answers, explicit accuracy percentages recorded for Levels 1–3
- **Session B profile:** High-performing/"brilliant-child" path — all answers correct throughout
- **Method:** Questions, response formats, correct answers, and per-question results (correct/wrong) were recorded in exact chronological order from observation sheets/screenshots for each level, in each session
- **Purpose:** To document the observable question sequence under two contrasting performance conditions, compare them directly, and use the contrast to infer the underlying sequencing logic

**Limitations:**
- Two performance paths were observed; intermediate performance levels (e.g., a learner who gets roughly half of questions wrong) were not observed and are not described here.
- The internal decision logic (e.g., how "similar" a repeat question is calculated, or how the review queue is internally stored) is not directly visible — only its observable output is documented.
- Level 4 in both sessions, and Level 10 in Session A, were recorded as rule/format descriptions with sample question sets rather than itemized per-question answered sequences, and are treated separately.
- Session A's Level 3 table ends at Question 15 (not 16, as in Levels 1–2), and the review-phase trigger language differs slightly across levels ("Wrong → system enters Previous Mistakes review" vs. "Still wrong → system enters Previous Mistakes review") — these differences are preserved as observed rather than normalized.
- Some handwritten/transcribed values may carry minor uncertainty; where relevant this is flagged in place rather than silently resolved.
- This report describes **observed system behavior only** and clearly separates observation from analytical interpretation, especially in Section 8 (the algorithm).

---

# 3. Session A — Struggling Path: Level-by-Level Observed Sequence

## Level 1 (Session A)

| Seq. No. | Question | Skill | Response Format | Correct Answer | Result |
|---|---|---|---|---|---|
| 1 | Pattern: 2+1=3, 3+1=4, 4+1=? | Addition pattern | Two-option selection | 5 | WRONG |
| 2 | Pattern: 4+1=5, 4+2=6, 4+3=? | Addition pattern | Two-option selection | 7 | CORRECT |
| 3 | What's 5° plus 3°? | Temperature addition | Number-line tap | 8° | WRONG |
| 4 | 2 + □ = 3 | Missing addend | Multiple choice | 1 | WRONG |
| 5 | 4 + 1 = □ | Direct addition | Number-line tap | 5 | WRONG |
| 6 | *(Motivation message: "Keep going! Practice makes perfect.")* | — | — | — | — |
| 7 | Help Lily: What's 2 ft plus 4 ft? | Length addition | Number-line tap | 6 ft | WRONG |
| 8 | □ + 4 = 10 | Missing addend | Number-line tap | 6 | WRONG |
| 9 | □ + 1 = 3 | Missing addend | Number-line tap | 2 | WRONG |
| 10 | What's 3 in plus 6 in? | Length addition | Two-option selection | 9 in | WRONG |
| 11 | 5 + 3 = □ | Direct addition | Number-line tap | 8 | CORRECT |
| 12 | 7 = _____ (complete the equation) | Equation completion | Equation construction | 7 = 5 + 2 | WRONG |
| 13 | What's 3° plus 5°? | Temperature addition | Two-option selection (thermometers) | 8° | WRONG |
| 14 | 3 + □ = 8 | Missing addend | Keypad entry | 5 | WRONG |
| 15 | 2 + 3 = □ | Direct addition | Keypad entry | 5 | WRONG |
| 16 | What's 5 kg heavier than 3 kg? | Weight addition | Drag and drop | 8 kg | WRONG — triggers review phase |

**Previous Mistakes – Review Phase (Level 1, Session A):** Questions 1, 3, 4, 5, 7, 8, 9, 10, 12, 13, 14, 15, 16 (13 items — every wrong question, in original order) were replayed sequentially.

**Final observed accuracy: 48%**

---

## Level 2 (Session A)

| Seq. No. | Question | Skill | Response Format | Correct Answer | Result |
|---|---|---|---|---|---|
| 1 | Pattern: 10−4=6, 11−4=7, 12−4=? | Subtraction pattern | Two-option selection | 8 | WRONG |
| 2 | Pattern: 4−1=3, 4−2=2, 4−3=? | Subtraction pattern | Two-option selection | 1 | CORRECT |
| 3 | What's 5° colder than 10°? | Temperature subtraction | Two-option selection (thermometers) | 5° | WRONG |
| 4 | 6 − □ = 6 | Missing subtrahend | Multiple choice | 0 | WRONG |
| 5 | 7 = _____ (complete the equation) | Equation completion | Equation construction | 7 = 11 − 4 | WRONG |
| 6 | *(Motivation message: "I believe in you.")* | — | — | — | — |
| 7 | Help Lucy: What's 1° less than 9°? | Temperature subtraction | Number-line tap | 8° | WRONG |
| 8 | 4 − □ = 3 | Missing subtrahend | Number-line tap | 1 | WRONG |
| 9 | 3 = _____ (complete the equation) | Equation completion | Equation construction | 3 = 6 − 3 | WRONG |
| 10 | What's 5 kg less than 6 kg? | Weight subtraction | Drag and drop | 1 kg | WRONG |
| 11 | □ − 7 = 1 | Missing minuend | Number-line tap | 8 | CORRECT |
| 12 | □ − 4 = 1 | Missing minuend | Number-line tap | 5 | (Correct → next question) |
| 13 | What's 6° less than 16°? *(Note: Hard)* | Temperature subtraction | Number-line tap | 10° | WRONG |
| 14 | 8 − □ = 1 | Missing subtrahend | Number-line tap | 7 | WRONG |
| 15 | 13 − 2 = □ | Direct subtraction | Keypad entry | 11 | WRONG |
| 16 | What's 2 m shorter than 11 m? | Length subtraction | Two-option selection | 9 m | WRONG — "Still wrong" → triggers review phase |

**Previous Mistakes – Review Phase (Level 2, Session A):** 14 previously wrong questions replayed sequentially.

**Final observed accuracy: 42%**

---

## Level 3 (Session A)

| Seq. No. | Question | Skill | Response Format | Correct Answer | Result |
|---|---|---|---|---|---|
| 1 | Pattern: 1×2=2, 1×3=3, 1×4=? | Multiplication representation | Two-option selection | 4 | WRONG |
| 2 | Pattern: 5×2=10, 5×3=15, 5×4=? | Multiplication representation | Two-option selection | 20 | WRONG |
| 3 | What's 5 mL plus 5 mL? | Capacity addition | Scale tap | 10 mL | WRONG |
| — | *(Motivation message: "Keep going! You are doing great.")* | — | — | — | — |
| 4 | 5 + 5 + 5 = □ | Repeated addition | Multiple choice | 15 | WRONG |
| 5 | 6 + 6 + 6 + 6 = □ | Repeated addition | Number-line tap | 24 | WRONG |
| 6 | How much is 2 mL and 2 mL in total? | Capacity addition | Multiple choice | 4 mL | CORRECT |
| 7 | 6 + 6 + 6 = □ | Repeated addition | Number-line tap | 18 | WRONG |
| 8 | 4 + 4 + 4 = □ | Repeated addition | Keypad entry | 12 | WRONG |
| 9 | How much is the sum of $6, $6 and $1? | Money addition | Drag and drop | $13 | WRONG |
| 10 | 6 = _____ (complete the equation) | Equation completion | Equation construction | 6 = 2 × 3 | WRONG |
| 11 | 6 × 3 = □ | Multiplication representation | Number-line tap | 18 | WRONG |
| 12 | How much is the sum of $8, $8 and $8? | Money addition | Drag and drop | $24 | WRONG |
| 13 | 6 = _____ (complete the equation) | Equation completion | Equation construction | 6 = 4 + 2 | WRONG |
| 14 | 5 + 5 + 5 = □ | Repeated addition | Keypad entry | 15 | WRONG |
| 15 | What's 3 ft plus 3 ft? | Length addition | Multiple choice | 6 ft | CORRECT — "Wrong → system enters Previous Mistakes review" *(label as observed, despite this response being correct — flagged as an observed inconsistency, not resolved by assumption)* |

**Final observed accuracy: 4%**

---

## Level 4 (Session A)

Documented as a rule-based description, not an itemized answered sequence (same structure and figures as Session B's Level 4 — see Section 5):
- Question type: "Tap and Match" (addition equations to answers)
- Bonus Level rule: correct answer removes a bonus item; wrong answer leaves it
- Timer: 1 minute 45 seconds
- Pass requirement: minimum 25 correct answers to cross Level 4
- Maximum number used in sums: 20

---

## Level 5 (Session A)

| Seq. No. | Question | Skill | Response Format | Correct Answer | Result |
|---|---|---|---|---|---|
| 1 | Tap and Match: 6+6→12, 2+0→2, 5+6→11 | Direct addition | Match interaction | (all matched) | CORRECT |
| 2 | □ + 5 = 11 | Missing addend | Multiple choice | 6 | WRONG |
| 3 | What's 1° less than 9°? | Temperature subtraction | Scale tap | 8° | WRONG |
| 4 | 4 = _____ (complete the equation) | Equation completion | Equation construction | (should make 4) | WRONG |
| 5 | 10 − 4 = □ | Direct subtraction | Keypad entry | 6 | WRONG |
| 6 | What's 6° less than 16°? | Temperature subtraction | Scale tap | 10° | WRONG |
| 7 | 2 + □ = 5 | Missing addend | Number-line tap | 3 | WRONG |
| 8 | 8 − □ = 4 | Missing subtrahend | Keypad entry | 4 | WRONG |
| 9 | What's 5° colder than 10°? | Temperature subtraction | Two-option selection | 5° | WRONG |
| 10 | 2 + 1 = □ | Direct addition | Number-line tap | 3 | WRONG |
| 11 | □ − 0 = 5 | Missing minuend | Keypad entry | 5 | CORRECT |
| 12 | What's 1 m less than 5 m? | Length subtraction | Scale tap | 4 m | WRONG |
| 13 | 2 + 1 = □ | Direct addition | Number-line tap | 3 | WRONG |
| 14 | 4 + 3 = □ | Direct addition | Keypad entry | 7 | CORRECT |
| 15 | What's 4 g plus 3 g? | Weight addition | Multiple choice | 7 g | WRONG |

**Previous Mistakes – Review Phase:** Triggered after Question 15 (correct or wrong), replaying all previously wrong questions in sequence, then continuing with the next set of Level 5 questions (per on-screen rule note).

---

## Level 6 (Session A)

| Seq. No. | Question | Skill | Response Format | Correct Answer | Result |
|---|---|---|---|---|---|
| 1 | Pattern: 2+1=3, 2+2=4, 2+3=? | Addition pattern | Multiple choice | 5 | WRONG |
| 2 | Pattern: 3+0=3, 3+1=4, 3+2=? | Addition pattern | Multiple choice | 5 | WRONG |
| 3 | What's 2 ft plus 4 ft? | Length addition | Number-line tap | 6 ft | CORRECT |
| 4 | □ + 3 = 5 | Missing addend | Multiple choice | 2 | CORRECT |
| 5 | 5 + 3 = □ | Direct addition | Keypad entry | 8 | WRONG |
| 6 | What's 3° plus 5°? | Temperature addition | Multiple choice (thermometers) | 8° | CORRECT |
| 7 | □ + 2 = 5 | Missing addend | Number-line tap | 1 | CORRECT |
| 8 | □ + 3 = 4 | Missing addend | Number-line tap | 1 | CORRECT |
| 9 | What's 3 in plus 6 in? | Length addition | Multiple choice | 9 in | CORRECT |
| 10 | 3 + □ = 7 | Missing addend | Number-line tap | 4 | CORRECT |
| 11 | 6 = _____ (complete the equation) | Equation completion | Equation construction | (any valid = 6) | WRONG |
| 12 | What's 5° plus 3°? | Temperature addition | Scale tap | 8° | WRONG |
| 13 | 6 + 6 = □ | Direct addition | Keypad entry | 12 | WRONG |
| 14 | 2 + 4 = □ | Direct addition | Number-line tap | 6 | CORRECT |
| 15 | What's 5 kg heavier than 3 kg? | Weight addition | Drag and drop | 8 kg | WRONG |

**Previous Mistakes – Review Phase:** Triggered after Question 15, replaying all wrong questions (1, 2, 5, 11, 12, 13, 15) sequentially.

---

## Level 7 (Session A)

| Seq. No. | Question | Skill | Response Format | Correct Answer | Result |
|---|---|---|---|---|---|
| 1 | Pattern: 2+1=3, 2+2=4, 2+3=? | Addition pattern | Multiple choice | 5 | WRONG |
| 2 | Pattern: 5+0=5, 5+1=6, 5+2=? | Addition pattern | Multiple choice | 7 | WRONG |
| 3 | What's 5° plus 3°? | Temperature addition | Scale tap | 8° | WRONG |
| 4 | □ + 3 = 6 | Missing addend | Multiple choice | 3 | WRONG |
| 5 | □ + 1 = 2 | Missing addend | Keypad entry | 1 | CORRECT |
| 6 | What's 2 ft plus 4 ft? | Length addition | Scale tap | 6 ft | WRONG |
| 7 | 4 + 3 = □ | Direct addition | Keypad entry | 7 | WRONG |
| 8 | 3 + □ = 6 | Missing addend | Keypad entry | 3 | WRONG |
| 9 | What's 3 g plus 5 g? | Weight addition | Drag and drop | 8 g | WRONG |
| 10 | □ + 2 = 3 | Missing addend | Number-line tap | 1 | CORRECT |
| 11 | □ + 3 = 5 | Missing addend | Number-line tap | 2 | CORRECT |
| 12 | What's 5° plus 3°? | Temperature addition | Multiple choice (thermometers) | 8° | CORRECT |
| 13 | 8 = _____ (complete the equation) | Equation completion | Equation construction | (any valid = 8) | WRONG |
| 14 | 10 = _____ (complete the equation) | Equation completion | Equation construction | (any valid = 10) | WRONG |
| 15 | What's 3 in plus 6 in? | Length addition | Multiple choice | 9 in | CORRECT |

**Previous Mistakes – Review Phase:** Triggered after Question 15, replaying questions 1, 2, 3, 4, 6, 7, 8, 9, 13, 14 sequentially.

---

## Level 8 (Session A)

| Seq. No. | Question | Skill | Response Format | Correct Answer | Result |
|---|---|---|---|---|---|
| 1 | 6 + 0 = □ | Direct addition | Multiple choice | 6 | WRONG |
| 2 | □ + 4 = 4 | Missing addend | Multiple choice | 0 | CORRECT |
| 3 | What's 2 ft plus 4 ft? | Length addition | Scale tap | 6 ft | WRONG |
| 4 | 6 + □ = 10 | Missing addend | Number-line tap | 4 | WRONG |
| 5 | 4 + 2 = □ | Direct addition | Keypad entry | 6 | CORRECT |
| 6 | What's 6° plus 4°? | Temperature addition | Scale tap | 10° | WRONG |
| 7 | 4 + 3 = □ | Direct addition | Number-line tap | 7 | WRONG |
| 8 | 3 + 2 = □ | Direct addition | Keypad entry | 5 | CORRECT |
| 9 | What's 5° plus 3°? | Temperature addition | Scale tap | 8° | WRONG |
| 10 | 5 + 3 = □ | Direct addition | Keypad entry | 8 | WRONG |
| 11 | 4 + □ = 7 | Missing addend | Keypad entry | 3 | CORRECT |
| 12 | What's 3 in plus 6 in? | Length addition | Multiple choice | 9 in | CORRECT |
| 13 | □ + 4 = 8 | Missing addend | Number-line tap | 4 | CORRECT |
| 14 | 5 + □ = 9 | Missing addend | Number-line tap | 4 | CORRECT |
| 15 | What's 4 g plus 3 g? | Weight addition | Multiple choice | 7 g | CORRECT |

**Previous Mistakes – Review Phase:** Triggered after Question 15, replaying questions 1, 3, 4, 6, 7, 9, 10 sequentially.

---

## Level 9 (Session A)

| Seq. No. | Question | Skill | Response Format | Correct Answer | Result |
|---|---|---|---|---|---|
| 1 | Match: 2+3→5, 3+1→4, 3+4→7 | Direct addition | Match interaction | (all matched) | CORRECT (All Correct) |
| 2 | □ + 4 = 9 | Missing addend | Multiple choice | 5 | WRONG |
| 3 | What's 3 in plus 6 in? | Length addition | Multiple choice | 9 in | CORRECT |
| 4 | 3 + □ = 8 | Missing addend | Keypad entry | 5 | WRONG |
| 5 | □ + 5 = 8 | Missing addend | Keypad entry | 3 | WRONG |
| 6 | What's 6° plus 4°? | Temperature addition | Scale tap | 10° | WRONG |
| 7 | □ + 5 = 7 | Missing addend | Keypad entry | 2 | WRONG |
| 8 | 6 + 5 = □ | Direct addition | Keypad entry | 11 | CORRECT |
| 9 | What's 5° plus 3°? | Temperature addition | Scale tap | 8° | WRONG |
| 10 | 3 + 5 = □ | Direct addition | Number-line tap | 8 | CORRECT |
| 11 | 2 + □ = 5 | Missing addend | Keypad entry | 3 | CORRECT |
| 12 | What's 2 ft plus 4 ft? | Length addition | Scale tap | 6 ft | CORRECT |
| 13 | 4 + 6 = □ | Direct addition | Number-line tap | 10 | CORRECT |
| 14 | 3 + 2 = □ | Direct addition | Number-line tap | 5 | CORRECT |
| 15 | What's 4 L plus 1 L? | Capacity addition | Multiple choice | 5 L | WRONG |

**Previous Mistakes – Review Phase:** Triggered after Question 15, replaying questions 2, 4, 5, 6, 7, 9, 15 sequentially.

---

## Level 10 (Session A)

Documented as a generic, continuous timed matching-game description rather than an itemized answered sequence:
- Timer: 1 minute 45 seconds
- Question type: Tap and match addition equations with answers
- Questions keep changing continuously based on speed
- All addition sums within range 0–15
- Progression: Achieve at least 1 Star (25 correct answers) to move to the next level

**Observation note:** No per-question correct/wrong results are available for Level 10 in Session A, distinguishing it from Levels 1–3 and 5–9 in the same session, which do include per-question results.

---

# 4. Session A — Master Comparison Table

| Level | Base Questions | Wrong Count (Base) | Correct Count (Base) | Accuracy (if shown) | Review Phase Triggered? | Primary Skill Focus |
|---|---|---|---|---|---|---|
| 1 | 16 | 14 | 2 | 48% | Yes (13 items) | Addition, missing addend |
| 2 | 16 | 14 | 2 | 42% | Yes (14 items) | Subtraction, missing subtrahend/minuend |
| 3 | 15 | 13 | 2 | 4% | Yes | Multiplication representation, repeated addition |
| 4 | Rule-based, not itemized | — | — | — | N/A (timed drill) | Direct addition |
| 5 | 15 | 10 | 3 (+1 match, all correct) | Not shown | Yes | Mixed addition/subtraction |
| 6 | 15 | 6 | 9 | Not shown | Yes | Addition, missing addend |
| 7 | 15 | 10 | 5 | Not shown | Yes | Addition, missing addend |
| 8 | 15 | 7 | 8 | Not shown | Yes | Addition, missing addend |
| 9 | 15 | 7 | 8 (+1 match, all correct) | Not shown | Yes | Addition, missing addend |
| 10 | Rule-based, not itemized | — | — | — | Not observable | Addition (matching format) |

**Observation:** Accuracy percentage is explicitly displayed only for Levels 1–3 in the available Session A material; Levels 5–9 show individual results but no summary accuracy figure in the provided evidence. This is noted as a gap in the observation rather than assumed to be absent from the actual system.

---

# 5. Session B — Brilliant-Child Path: Level-by-Level Observed Sequence

## Level 1 (Session B)

| Seq. No. | Question / Pattern | Skill | Response Format | Context/Unit | Range/Scale | Stage |
|---|---|---|---|---|---|---|
| 1 | Pattern: 2+6=8, 3+6=9, 4+6=? | Addition pattern | Two-option selection | — | Options: 10, 11 | Base |
| 2 | Pattern: 4+1=5, 4+2=6, 4+3=? | Addition pattern | Two-option selection | — | Options: 6, 7 | Base |
| 3 | What's 2 ft plus 4 ft? | Length addition | Scale interaction | ft | 0–6 | Base |
| 4 | □ + 2 = 7 | Missing addend | Multiple choice | — | Options: 5, 9, 20, 500 | Base |
| 5 | 5 + 3 = □ | Direct addition | Keypad entry | — | — | Base |
| 6 | What's 3 in plus 6 in? | Length addition | Two-option selection | in | Options: 3 in, 9 in | Base |
| 7 | 3 = □ □ □ (fill tiles) | Number decomposition | Equation construction | — | Tiles: 5, +, 3, 2, 1, 4, + | Base |
| 8 | □ + 4 = 10 | Missing addend | Number-line interaction | — | 0–24 | Base |
| 9 | What's 5° plus 3°? | Temperature addition | Scale interaction | ° | 0–20 | Base |
| 10 | 3 + □ = 7 | Missing addend | Number-line interaction | — | 0–8 | Base |
| 11 | □ + 4 = 8 | Missing addend | Number-line interaction | — | 0–8 | Base |
| 12 | What's 6° plus 4°? | Temperature addition | Scale interaction | ° | 0–25 | Base |
| 13 | 5 + □ = 10 | Missing addend | Number-line interaction | — | 0–20 | Base |
| 14 | □ + 1 = 6 | Missing addend | Get as close as you can | — | 0–20 | Hard Exercise |
| 15 | 4 + 2 = □ | Direct addition | Get as close as you can | — | 0–24 | Hard Exercise |

*All 15 questions CORRECT. No review phase triggered.*

## Level 2 (Session B)

| Seq. No. | Question / Pattern | Skill | Response Format | Context/Unit | Range/Scale | Stage |
|---|---|---|---|---|---|---|
| 1 | Pattern: 6−1=5, 6−2=4, 6−3=? | Subtraction pattern | Two-option selection | — | Options: 3, 30 | Base |
| 2 | Pattern: 13−2=11, 13−4=9, 13−6=? | Subtraction pattern | Two-option selection | — | Options: 1, 7 | Base |
| 3 | What's 6° less than 16°? | Temperature subtraction | Scale interaction | ° | 0–20 | Base |
| 4 | 8 − □ = 6 | Missing subtrahend | Multiple choice | — | Options: 2, 3, 9 | Base |
| 5 | 6 − 2 = □ | Direct subtraction | Number-line interaction | — | 0–16 | Base |
| 6 | What's 5° colder than 10°? | Temperature subtraction | Two-option selection | ° | Options: 5°, 15° | Base |
| 7 | 8 − 4 = □ | Direct subtraction | Keypad entry | — | — | Base |
| 8 | 9 = □ □ □ (fill tiles) | Number decomposition | Equation construction | — | Tiles: 11, +, 6, −, 1, 5, −, 8, 3, +, +, 2, 7, 4 | Base |
| 9 | What's 1 m less than 7 m? | Length subtraction | Two-option selection | m | Options: 6 m, 8 m | Base |
| 10 | 13 − 2 = □ | Direct subtraction | Number-line interaction | — | 0–44 | Base |
| 11 | 9 − □ = 3 | Missing subtrahend | Number-line interaction | — | 0–12 | Base |
| 12 | What's 1° less than 9°? | Temperature subtraction | Scale interaction | ° | 0–10 | Base |
| 13 | □ − 0 = 4 | Missing minuend | Number-line interaction | — | 0–4 | Base |
| 14 | 6 − □ = 2 | Missing subtrahend | Get as close as you can | — | 0–8 | Hard Exercise |
| 15 | 8 = (select all expressions equal to 8): 10−2, 400−6, 14−6, 6−14 | Number decomposition | Select all that match | — | — | Hard Exercise |

*All 15 questions CORRECT. No review phase triggered.*

## Level 3 (Session B)

| Seq. No. | Question / Pattern | Skill | Response Format | Context/Unit | Range/Scale | Stage |
|---|---|---|---|---|---|---|
| 1 | Pattern: 1×2=2, 1×3=3, 1×4=? | Multiplication representation | Two-option selection | — | Options: 4, 40 | Base |
| 2 | Pattern: 5×2=10, 5×3=15, 5×4=? | Multiplication representation | Two-option selection | — | Options: 19, 20 | Base |
| 3 | Sum of $8, $8, $8? | Money addition | Drag and drop | $ | Tiles: $1, $5, $20 | Base |
| 4 | 8 + 8 + 8 = □ | Repeated addition | Multiple choice | — | Options: 24, 34, 83 | Base |
| 5 | 2 + 2 + 2 + 2 = □ | Repeated addition | Keypad entry | — | — | Base |
| 6 | How much is 2 mL and 2 mL in total? | Capacity addition | Scale interaction | mL | 0–2 (per beaker) | Base |
| 7 | Complete the equation: 3 = □ □ □ | Equation completion | Equation construction | — | Tiles: 3, 2, 1, +, −, ×, ÷ | Base |
| 8 | Complete the equation: 24 = □ □ □ □ □ □ | Equation completion | Equation construction | — | Tiles: 24, 12, 8, 6, 4, 3, +, −, ×, ÷, (, ) | Base |
| 9 | What's 5 mL plus 5 mL? | Capacity addition | Scale interaction | mL | 0–10 | Base |
| 10 | Complete the equation: 9 = □ □ □ □ □ □ | Equation completion | Equation construction | — | Tiles: 9, 8, 7, 6, 5, 4, 3, +, −, ×, ÷, (, ) | Base |
| 11 | Complete the equation: 10 = □ □ □ | Equation completion | Equation construction | — | Tiles: 10, 6, 5, 4, 3, 2, +, −, ×, ÷, (, ) | Base |
| 12 | Sum of $6, $6, $6? | Money addition | Drag and drop | $ | Tiles: $1, $5, $10 | Base |
| 13 | 5 + 5 + 5 = □ | Repeated addition | Keypad entry | — | — | Base |
| 14 | 2 + 2 + 2 + 2 = □ | Repeated addition | Number-line interaction | — | 0–32 | Hard Exercise |
| 15 | 3 × 2 = □ | Multiplication representation | Number-line interaction | — | 0–12 | Hard Exercise |

*All 15 questions CORRECT. No review phase triggered.*

## Level 4 (Session B)

Documented as a rule-based description (not itemized): continuous timed addition drill, timer 1:45, maximum sum 20, 25 correct answers required for 1 star, no fixed sequence.

## Level 5 (Session B)

| Seq. No. | Question | Skill | Response Format | Context/Unit | Range/Scale | Stage |
|---|---|---|---|---|---|---|
| 1 | 4 + 4 + 4 = □ | Repeated addition | Multiple choice | — | Options: 2, 12, 43 | Base |
| 2 | □ + 4 = 10 | Missing addend | Multiple choice | — | Options: 1, 6, 7 | Base |
| 3 | What's 2 ft plus 4 ft? | Length addition | Scale interaction | ft | 0–6 | Base |
| 4 | 4 + 4 = □ | Direct addition | Keypad entry | — | — | Base |
| 5 | 4 = □ □ □ (make equation true) | Number decomposition | Equation construction | — | Tiles: 1–9, +, −, ×, ÷, =, (, ) | Base |
| 6 | What's 6° plus 4°? | Temperature addition | Scale interaction | ° | 0–25 | Base |
| 7 | 3 × 4 = □ | Multiplication representation | Keypad entry | — | — | Base |
| 8 | 5 + 5 = □ | Direct addition | Keypad entry | — | — | Base |
| 9 | What's 5° plus 3°? | Temperature addition | Scale interaction | ° | 0–20 | Base |
| 10 | 6 = □ □ □ (make equation true) | Number decomposition | Equation construction | — | Tiles: 1–9, +, −, ×, ÷, =, (, ) | Base |
| 11 | 2 + 2 + 2 + 2 = □ | Repeated addition | Keypad entry | — | — | Base |
| 12 | What's 3 in plus 6 in? | Length addition | Two-option selection | in | Options: 3 in, 9 in | Base |
| 13 | 2 + □ = 7 | Missing addend | Number-line interaction | — | 0–20 | Base |
| 14 | 9 − □ = 7 | Missing subtrahend | Number-line interaction | — | 0–4 | Hard Exercise |
| 15 | □ − 3 = 6 | Missing minuend | Number-line interaction | — | 0–12 | Hard Exercise |

*All 15 questions CORRECT. No review phase triggered.*

## Level 6 (Session B)

| Seq. No. | Question | Skill | Response Format | Context/Unit | Range/Scale | Stage |
|---|---|---|---|---|---|---|
| 1 | Pattern: 2+5=7, 3+5=8, 4+5=? | Addition pattern | Two-option selection | — | Options: 9, 90 | Base |
| 2 | Pattern: 2+2=4, 3+2=5, 4+2=? | Addition pattern | Two-option selection | — | Options: 4, 6 | Base |
| 3 | What's 2 ft plus 4 ft? | Length addition | Scale interaction | ft | 0–6 | Base |
| 4 | □ + 3 = 7 | Missing addend | Multiple choice | — | Options: 0, 4, 40 | Base |
| 5 | 6 + □ = 11 | Missing addend | Number-line interaction | — | 0–20 | Base |
| 6 | What's 3 in plus 6 in? | Length addition | Two-option selection | in | Options: 3 in, 9 in | Base |
| 7 | □ + 3 = 9 | Missing addend | Number-line interaction | — | 0–12 | Base |
| 8 | □ + 2 = 4 | Missing addend | Keypad entry | — | — | Base |
| 9 | What's 6 g plus 5 g? | Weight addition | Visual measurement selection | g | Options: 1 g, 11 g | Base |
| 10 | 6 + □ = 8 | Missing addend | Keypad entry | — | — | Base |
| 11 | □ + 4 = 8 | Missing addend | Number-line interaction | — | 0–4 | Base |
| 12 | What's 5° plus 3°? | Temperature addition | Scale interaction | ° | 0–20 | Base |
| 13 | 4 + 5 = □ | Direct addition | Number-line interaction | — | 0–12 | Base |
| 14 | 4 + 4 = □ | Direct addition | Number-line interaction | — | 0–16 | Base |
| 15 | □ + 5 = 11 | Missing addend | Number-line interaction | — | 0–24 | Hard Exercise |

*All 15 questions CORRECT. No review phase triggered.*

## Level 7 (Session B)

| Seq. No. | Question | Skill | Response Format | Context/Unit | Range/Scale | Stage |
|---|---|---|---|---|---|---|
| 1 | □ + 3 = 7 | Missing addend | Multiple choice | — | Options: 4, 10, 400 | Base |
| 2 | 2 + 2 = □ | Direct addition | Multiple choice | — | Options: 0, 3, 4 | Base |
| 3 | What's 6° plus 4°? | Temperature addition | Scale interaction | ° | 0–25 | Base |
| 4 | 9 = □ □ □ (make equation true) | Equation completion | Equation construction | — | Tiles: 4, 3, 7, 6, 1, 2, 5, +, −, ×, ÷ | Base |
| 5 | 4 + 3 = □ | Direct addition | Number-line interaction | — | 0–28 | Base |
| 6 | What's 3 in plus 6 in? | Length addition | Two-option selection | in | Options: 3 in, 9 in | Base |
| 7 | □ + 4 = 5 | Missing addend | Number-line interaction | — | 0–4 | Base |
| 8 | 6 + 4 = □ | Direct addition | Number-line interaction | — | 0–20 | Base |
| 9 | What's 2 ft plus 4 ft? | Length addition | Scale interaction | ft | 0–6 | Base |
| 10 | 4 + 4 = □ | Direct addition | Keypad entry | — | — | Base |
| 11 | □ + 2 = 6 | Missing addend | Keypad entry | — | — | Base |
| 12 | What's 6 g plus 5 g? | Weight addition | Visual measurement selection | g | Options: 1 g, 11 g | Base |
| 13 | 9 = □ □ □ (make equation true) | Equation completion | Equation construction | — | Tiles: 4, 3, 7, 6, 1, 2, 5, +, −, ×, ÷ | Base |
| 14 | 5 + 4 = □ | Direct addition | Get as close as you can | — | 0–36 | Hard Exercise |
| 15 | □ + 2 = 7 | Missing addend | Number-line interaction | — | 0–20 | Hard Exercise |

*All 15 questions CORRECT. No review phase triggered.*

## Level 8 (Session B)

| Seq. No. | Question | Skill | Response Format | Context/Unit | Range/Scale | Stage |
|---|---|---|---|---|---|---|
| i | 5 + 1 = □ | Direct addition | Multiple choice | — | Options: 6, 16, 600 | Base |
| ii | 6 + □ = 11 | Missing addend | Multiple choice | — | Options: 5, 6, 8 | Base |
| iii | What's 5° plus 3°? | Temperature addition | Scale interaction | ° | 0–20 | Base |
| iv | 3 + 0 = □ | Direct addition | Keypad entry | — | — | Base |
| v | 5 + 5 = □ | Direct addition | Number-line interaction | — | 0–40 | Base |
| vi | What's 3 g plus 5 g? | Weight addition | Visual measurement selection | g | Options: 1 g, 5 g, 10 g | Base |
| vii | □ + 2 = 3 | Missing addend | Number-line interaction | — | 0–4 | Base |
| viii | 6 + □ = 10 | Missing addend | Keypad entry | — | — | Base |
| ix | What's 2 ft plus 4 ft? | Length addition | Scale interaction | ft | 0–6 | Base |
| x | □ + 1 = 4 | Missing addend | Keypad entry | — | — | Base |
| xi | 5 + 1 = □ | Direct addition | Keypad entry | — | — | Base |
| xii | What's 3 in plus 6 in? | Length addition | Two-option selection | in | Options: 3 in, 9 in | Base |
| xiii | 5 + 5 = □ | Direct addition | Get as close as you can | — | 0–20 | Hard Exercise |
| xiv | 4 + 3 = □ | Direct addition | Get as close as you can | — | 0–28 | Hard Exercise |
| xv | □ + 1 = 6 | Missing addend | Get as close as you can | — | 0–20 | Hard Exercise |

*All 15 questions CORRECT. No review phase triggered.*

## Level 9 (Session B)

| Seq. No. | Question | Skill | Response Format | Context/Unit | Range/Scale | Stage |
|---|---|---|---|---|---|---|
| i | 4 + 3 = □ (Max 10) | Direct addition | Keypad entry | — | Max 10 | Base |
| ii | 5 + 2 = □ (Max 10) | Direct addition | Keypad entry | — | Max 10 | Base |
| iii | 6 + 2 = □ (Max 10) | Direct addition | Keypad entry | — | Max 10 | Base |
| iv | 3 + 5 = □ (Max 10) | Direct addition | Keypad entry | — | Max 10 | Base |
| v | □ + 2 = 9 (Max 10) | Missing addend | Number-line interaction | — | 0–10 | Base |
| vi | 9 − 3 = □ (Max 10) | Direct subtraction | Keypad entry | — | Max 10 | Base |
| vii | □ + 4 = 10 (Max 10) | Missing addend | Number-line interaction | — | 0–10 | Base |
| viii | 8 − 2 = □ (Max 10) | Direct subtraction | Keypad entry | — | Max 10 | Base |
| ix | What's 4 in plus 3 in? (Max 10) | Length addition | Two-option selection | in | Options: 4 in, 7 in | Base |
| x | 2 ft + 3 ft = ? (Max 10) | Length addition | Scale interaction | ft | 0–10 | Base |
| xi | 5 − 1 = □ (Max 10) | Direct subtraction | Keypad entry | — | Max 10 | Base |
| xii | 3 + 6 = □ (Max 10) | Direct addition | Number-line interaction | — | 0–10 | Base |
| xiii | □ + 1 = 8 (Max 10) | Missing addend | Keypad entry | — | Max 10 | Base |
| xiv | 5 + 5 = ? (Max 10) | Direct addition | Get as close as you can | — | 0–10 | Hard Exercise |
| xv | 3 + 4 = ? (Max 10) | Direct addition | Get as close as you can | — | 0–10 | Hard Exercise |

*All 15 questions CORRECT. No review phase triggered.*

## Level 10 (Session B)

| Seq. No. | Question | Skill | Response Format | Context/Unit | Range/Scale | Stage |
|---|---|---|---|---|---|---|
| i | 4 − 3 = □ (Max 20) | Direct subtraction | Keypad entry | — | Max 20 | Base |
| ii | 5 − 3 = □ (Max 20) | Direct subtraction | Keypad entry | — | Max 20 | Base |
| iii | 6 − 3 = □ (Max 20) | Direct subtraction | Keypad entry | — | Max 20 | Base |
| iv | 7 − 3 = □ (Max 20) | Direct subtraction | Keypad entry | — | Max 20 | Base |
| v | 8 − 3 = □ (Max 20) | Direct subtraction | Keypad entry | — | Max 20 | Base |
| vi | □ − 0 = 7 (Max 20) | Missing minuend | Keypad entry | — | Max 20 | Base |
| vii | What's 5° less than 9°? (Max 20) | Temperature subtraction | Number-line interaction | ° | 0–10 | Base |
| viii | 12 − 4 = □ (Max 20) | Direct subtraction | Keypad entry | — | Max 20 | Base |
| ix | What's 4 in less than 9 in? (Max 20) | Length subtraction | Two-option selection | in | Options: 4 in, 5 in | Base |
| x | 10 ft − 6 ft = ? (Max 20) | Length subtraction | Scale interaction | ft | 0–20 | Base |
| xi | 9 − 2 = □ (Max 20) | Direct subtraction | Keypad entry | — | Max 20 | Base |
| xii | 14 − 5 = □ (Max 20) | Direct subtraction | Keypad entry | — | Max 20 | Base |
| xiii | □ − 1 = 8 (Max 20) | Missing minuend | Keypad entry | — | Max 20 | Base |
| xiv | 7 − □ = 6 (Max 20) | Missing subtrahend | Get as close as you can | — | 0–10 | Hard Exercise |
| xv | 12 − □ = 5 (Max 20) | Missing subtrahend | Get as close as you can | — | 0–12 | Hard Exercise |

*All 15 questions CORRECT. No review phase triggered.*

**Observation note:** Session B's Level 10 is documented as an itemized, roman-numeral subtraction sequence with per-question results, unlike Session A's Level 10, which was documented as a generic rule description. This inconsistency between the two sessions' Level 10 records is preserved and flagged rather than resolved, since it cannot be verified from the available material whether it reflects two genuinely different level-10 formats or an incomplete observation in one of the two sessions.

---

# 6. Direct Cross-Session Comparison

| Level | Session A Result Pattern | Session B Result Pattern | Key Structural Difference |
|---|---|---|---|
| 1 | 2/16 correct in base pass; 13-item review phase; 48% accuracy | 15/15 correct; no review phase | Review phase only in Session A |
| 2 | 2/16 correct in base pass; 14-item review phase; 42% accuracy | 15/15 correct; no review phase | Review phase only in Session A |
| 3 | 2/15 correct in base pass; review phase triggered; 4% accuracy | 15/15 correct; no review phase | Review phase only in Session A; sharpest accuracy drop in dataset |
| 4 | Rule-based timed drill (identical structure to Session B) | Rule-based timed drill (identical structure to Session A) | No difference — same fixed mechanism regardless of path |
| 5 | 10/15 correct in base pass; review phase triggered | 15/15 correct; no review phase; Hard Exercise introduces subtraction | Session A repeats wrong items; Session B escalates format instead |
| 6 | 9/15 correct in base pass; review phase triggered | 15/15 correct; no review phase; weight/grams introduced | Same skill content, divergent branching outcome |
| 7 | 5/15 correct in base pass; review phase triggered | 15/15 correct; no review phase; format consolidation | Same skill content, divergent branching outcome |
| 8 | 8/15 correct in base pass; review phase triggered | 15/15 correct; no review phase; 3-question Hard Exercise | Same skill content, divergent branching outcome |
| 9 | 8/15 correct (+1 all-correct match) in base pass; review phase triggered | 15/15 correct; no review phase; explicit "Max 10" labelling | Same skill content, divergent branching outcome |
| 10 | Generic timed matching-game description; no itemized results available | Itemized roman-numeral subtraction sequence; 15/15 correct; explicit "Max 20" labelling | Level 10 format differs between sessions in the available material (see observation note above) |

**Core finding from the comparison:** In every itemized concept level (1, 2, 3, 5, 6, 7, 8, 9), the presence or absence of the "Previous Mistakes – Review Phase" tracks exactly with whether any wrong answers occurred in that level. This is the single clearest, most consistent piece of evidence for how the system's branching logic operates.

---

# 7. Question-Format Behavior Under Wrong vs. Correct Answers

Comparing the *same* question types across sessions shows a consistent format-scaffolding pattern:

| Skill / Structure | Session A (after a wrong answer) | Session B (after a correct streak) |
|---|---|---|
| Addition/subtraction with a missing number | Frequently shown with a number line or reduced multiple-choice options after an initial miss | Frequently shown with keypad entry or open multiple choice; escalates to "get as close as you can" in Hard Exercise |
| Equation completion | Uses smaller tile sets; several attempts are marked WRONG | Uses larger tile sets including ×, ÷, and brackets; consistently marked CORRECT |
| Measurement questions (ft, in, g, °) | Presented with two-option or scale-tap formats; frequently WRONG | Same formats, but consistently CORRECT and paired with an escalating Hard Exercise block |
| End-of-level challenge questions | Not clearly distinguished as "Hard Exercise" in Session A material — questions after Q15/16 are review-phase repeats of missed items | Explicitly labelled "HARD EXERCISE," offering harder-scale or open-ended estimation versions of the skill |

**Interpretation:** In the Struggling Path, the "extra" questions after the base set are **remediation** (repeats of exactly what was missed). In the Brilliant-Child Path, the "extra" questions after the base set are **enrichment** (harder, more open-ended versions of the same skill, e.g., "get as close as you can" estimation). This is treated as an analytical interpretation supported by, but not proven beyond, the two observed sessions.

---

# 8. The Derived Adaptive Algorithm

**Important framing note:** Everything in this section is an **analytical interpretation** derived by comparing Sessions A and B. It describes the *observable pattern* of system behavior, not confirmed internal source code or a verified specification from the developer. Cautious language is used throughout, consistent with the observation-based nature of this report.

## 8.1 High-Level Model

The evidence from both sessions is consistent with a **mistake-driven remediation and mastery-gating model**, rather than a statistical ability-estimation model (such as Item Response Theory / Computerized Adaptive Testing, which would select each new question based on a calculated probability of success). No evidence in either session suggests the system is estimating a continuous ability score — instead, its behavior appears to follow discrete, rule-like triggers tied directly to each individual answer.

## 8.2 Per-Question Decision Logic (Interpreted)

```
On receiving an answer to a question:

IF the answer is CORRECT:
    → Mark the question as CORRECT
    → Advance to the next question in the level's planned sequence
    → If the learner's streak within the level remains fully correct,
      later questions in the sequence draw from a "Hard Exercise" pool
      (larger scale ranges, open-ended "get as close as you can" tasks,
      expanded equation-tile sets, multi-answer "select all that match" tasks)

IF the answer is WRONG:
    → Mark the question as WRONG
    → Add the question to a level-scoped "Mistake Queue"
    → Continue to the next question in the base sequence as normal
      (the wrong question is not immediately repeated in the base pass;
       it is instead deferred to the review phase — this is the
       clearest reading supported by the Session A tables, where wrong
       questions 1–16 in Level 1 are not immediately re-asked but are
       all replayed together afterward)
```

## 8.3 End-of-Level Branch (Interpreted)

```
After the base question set completes (13–16 questions, varies by level):

IF the Mistake Queue is EMPTY:
    → Skip the review phase entirely
      (explicitly confirmed by the on-screen rule text:
       "No repeated review phase when all answers are correct")
    → Present 2–3 "Hard Exercise" questions
    → Mark the level "Completed" and advance to the next level

IF the Mistake Queue is NOT EMPTY:
    → Enter "Previous Mistakes – Review Phase"
    → Replay every mistaken question sequentially, in original order
    → After the review phase, continue to the next set of questions
      for that level (per the on-screen rule note observed in Level 5:
      "After reviewing these, the system continues with the next set
       of Level [n] questions")
```

## 8.4 Accuracy Calculation (Interpreted)

Where displayed (Levels 1–3 of Session A), the accuracy percentage appears to reflect **correct answers in the base pass only**, calculated before the review phase is added. This is consistent with the sharp drop from 48% (Level 1) to 4% (Level 3): each level resets its own accuracy count against a base pass of similar length, and the counts do not appear to carry over or average across levels.

## 8.5 Levels 4 and 10 — A Separate, Non-Branching Mechanism

Both sessions describe Level 4 identically: a fixed, timed, high-volume addition drill with a flat pass condition (25 correct answers within 1:45 to earn 1 star and unlock the next level). No mistake queue, no review phase, and no Hard Exercise block apply here. This indicates Level 4 (and, per the Session A description, potentially Level 10 in some configurations) operates on an entirely separate, rule-based **fluency gate** rather than the mistake-branching engine used elsewhere:

```
Fluency Gate (Levels 4, and possibly 10 depending on configuration):

SET timer = 1:45
LOOP until timer expires:
    Serve an addition (or, per Session A's Level 10, addition-matching) question
    within a fixed maximum sum (20 for Level 4; 15 for Level 10 per Session A)
    IF answer is correct: increment score
IF score >= 25:
    Award 1 star → unlock next level
```

**Note on the Level 10 discrepancy:** Session B's Level 10 does not match this fluency-gate description — it instead shows an itemized, mistake-branchable subtraction sequence with a Hard Exercise block, structurally identical to Levels 1–3 and 5–9. Because the two sessions disagree on Level 10's format, this report does not assert a single confirmed mechanism for Level 10 and instead presents both observed versions side by side (Sections 3 and 5) without resolving the conflict by assumption.

## 8.6 Summary Flow Diagram (Text Form)

```
┌─────────────────────────────┐
│   Present next base question │
└──────────────┬───────────────┘
               │
        Learner answers
               │
     ┌─────────┴─────────┐
     │                   │
  CORRECT              WRONG
     │                   │
     ▼                   ▼
Advance to next    Add to Mistake Queue,
question; if       advance to next
streak clean,      question anyway
draw from Hard
Exercise pool
     │                   │
     └─────────┬─────────┘
               │
   Base sequence complete
               │
      Mistake Queue empty?
               │
        ┌──────┴──────┐
      YES              NO
        │               │
        ▼               ▼
  Skip review      Enter Previous
  phase; run       Mistakes Review
  Hard Exercise;   Phase (replay
  mark level       all wrong items
  Completed        sequentially);
                   then continue
                   to next question
                   set / advance
```

---

# 9. Key Findings

1. The clearest and most consistent adaptive trigger observed across both sessions is: **any wrong answer in a level's base sequence causes a "Previous Mistakes – Review Phase" at the end of that level; zero wrong answers causes that phase to be skipped entirely.**
2. This trigger held true in every itemized level of both sessions (1, 2, 3, 5, 6, 7, 8, 9) without exception in the available data.
3. Accuracy percentages, where shown, appear tied to the base pass of a single level rather than to a cumulative or cross-level score.
4. Correct-answer streaks are associated with access to "Hard Exercise" questions that use wider scale ranges, expanded equation-tile sets, and open-ended estimation tasks — none of which appear in the Session A material as base-sequence or review-phase items.
5. Wrong answers are not immediately re-asked in the same position; they are deferred to a review phase after the full base sequence, based on the Session A tables.
6. The same core skills and often the same specific questions (e.g., "What's 2 ft plus 4 ft?", "What's 3 in plus 6 in?") appear in both sessions at the same levels, indicating the base question pool for a given level is likely shared across performance paths, with the *branching after* each answer differing rather than the *base content*.
7. Levels 4 (both sessions) operates on a separate, non-branching, timed fluency-gate mechanism, distinct from the mistake-branching mechanism used in the other levels.
8. Level 10 is documented inconsistently between the two sessions (fluency-gate style in Session A vs. mistake-branchable itemized sequence in Session B); this report treats this as an open discrepancy rather than resolving it by assumption.
9. Subtraction, multiplication-representation, and money/weight/capacity contexts are introduced at specific levels (2, 3, and 3/6 respectively) in both sessions, suggesting the base curriculum content is fixed by level regardless of performance path.
10. No evidence in either session indicates the system recalculates or reorders the base question *content* according to ability — the clearest adaptive behavior is the *branching after* the fixed content (review-phase vs. Hard-Exercise), not the content itself.

---

# 10. Limitations

- Two performance paths (all-wrong-heavy and all-correct) were observed; a mixed-performance path was not available for comparison, so the exact threshold or rule for *partial* mistake queues (e.g., what happens with 1 wrong answer out of 15) is inferred from the all-or-nothing evidence in Sections 3–5, not directly observed at that granularity.
- The internal implementation of the "Mistake Queue" (e.g., whether it is capped, whether repeated future wrongs are re-queued, whether it resets between levels) is not directly observable.
- Level 4's description and Level 10's Session-A-vs-Session-B discrepancy limit full confidence in a single unified mechanism for every level.
- Session A's accuracy percentage is only explicitly shown for Levels 1–3; whether it is calculated identically for Levels 5–9 could not be confirmed from the available material.
- This report's Section 8 algorithm is an interpretation constructed by comparing observed outputs, not a confirmed specification obtained from system documentation or source code.

---

# 11. Conclusion

Combining both observed sessions produces a coherent, evidence-based account of how this Class 2 adaptive module behaves: it appears to run a **fixed base-question pool per level**, wrapped in a **binary branching rule keyed to whether any mistakes occurred in that level's base pass**. A clean run skips remediation and is rewarded with harder, more open-ended enrichment questions ("Hard Exercise"); a run with mistakes is redirected into a mandatory, sequential replay of exactly what was missed, with no discernible move to expand or add new challenge material until those mistakes are cleared. Levels 4 (in both sessions) and, per Session A, Level 10 operate outside this mistake-branching structure entirely, instead using a flat, timed, volume-based pass/fail gate.

This model explains the two sessions' contrasting Level 1–3 accuracy trajectories (48% → 42% → 4% in Session A, alongside consistent triggering of the review phase) and the complete absence of any review phase across all ten levels of Session B. It is presented here as the best-supported interpretation of the available evidence, with explicit acknowledgment of where the two sessions disagree (Level 10) or where granularity is insufficient (partial-mistake scenarios) to state the mechanism with full certainty.

---

