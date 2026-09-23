# Concept Mastery Audit — Issue #401

## Audit Summary

This audit reviews how `conceptMastery` is currently produced across the FLN platform and how those results are consumed by the certification engine.

The primary finding is that `conceptMastery` currently has **multiple producing paths with different mechanisms and semantics**. Although all paths produce the same three labels — `Strong`, `Satisfactory`, and `Needs Practice` — they do not currently share one clearly defined business rule for determining those labels.

This creates a potential source of behavioral drift between assessment, student progression, and certification.

The audit therefore recommends establishing a **single, explicit, systematic business-logic definition for concept mastery**, while keeping the evaluation of individual student answers separate from the final mastery classification.

---

# 1. Background

This audit follows the concern raised around PR #242 (`feat(certification): R-7 Certification Engine`) and Issue #401.

The certification engine's eligibility decision is evidence-driven. It reads the `conceptMastery` map from a student's latest `EvaluationReport` and compares the mastery values against the competency requirements defined in:

```text
competencyRequirements.seed.json
```

The certification engine does not independently calculate concept mastery.

Therefore, the reliability of certification eligibility depends on the consistency and correctness of the upstream process that produces `EvaluationReport.conceptMastery`.

The audit was conducted to determine:

1. Which code paths currently produce `conceptMastery`.
2. How each path determines mastery.
3. Whether those mechanisms share the same semantics.
4. Whether the resulting values can be safely consumed by certification.
5. What systematic approach should be adopted to prevent future drift.

---

# 2. Current `conceptMastery` Production Paths

The repository currently contains three identifiable mechanisms that produce `conceptMastery`.

## Path 1 — Gemini-Generated Concept Mastery

**Location:**

```text
backend/src/gemini.ts
```

The standard worksheet evaluation path asks Gemini to return:

```text
score
conceptMastery
narrative
```

The `conceptMastery` object contains topic-level labels:

```text
Strong
Satisfactory
Needs Practice
```

The model receives the student's questions and submitted answers and determines the mastery classification itself.

### Characteristics

* Based on the student's submitted answers.
* Operates at topic level.
* Uses the model's interpretation of the student's performance.
* Does not expose a deterministic mathematical rule for assigning mastery.
* The returned mastery values are accepted as part of the structured Gemini response.

### Implication

The same underlying student performance could theoretically receive different mastery classifications across model evaluations because the classification is ultimately an LLM judgment rather than an explicitly defined deterministic business rule.

This makes the result difficult to reproduce and audit solely from application logic.

---

# 3. Path 2 — Deterministic Fallback Heuristic

**Location:**

```text
backend/src/gemini.ts
```

A separate fallback mechanism derives concept mastery from question-level correctness when the Gemini evaluation path fails.

The existing mechanism operates approximately as follows:

```text
First question for topic is correct
        ↓
Strong

First question for topic is incorrect
        ↓
Needs Practice

A later question for that topic is correct
        ↓
Satisfactory
```

The existing implementation therefore depends on the order in which questions for a topic are processed.

## Example

Consider two questions belonging to the same topic.

### Case A

```text
Question 1 → Incorrect
Question 2 → Correct
```

The topic can become:

```text
Satisfactory
```

### Case B

```text
Question 1 → Correct
Question 2 → Incorrect
```

The topic can remain:

```text
Strong
```

Although both cases contain:

```text
1 correct
1 incorrect
```

This means that the resulting mastery classification can depend on **question ordering** rather than solely on the student's aggregate performance for that topic.

### Audit finding

This mechanism is deterministic in the programming sense, but it is not sufficiently robust as a canonical definition of mastery.

The order of questions should not determine whether a student's demonstrated mastery is `Strong` or `Satisfactory`.

---

# 4. Path 3 — Diagnostic / Baseline Level-Threshold Heuristic

**Location:**

```text
backend/src/routes/students.ts
```

The diagnostic/baseline path uses a different approach.

Rather than deriving mastery from individual topic-level question performance, it maps the resulting recommended level against fixed topic thresholds.

The reviewed implementation uses topic-level bands such as:

```text
Number Sense
Shapes
Fractions
Operations
```

with fixed level thresholds.

This means the resulting concept mastery is derived from the student's level rather than directly from the questions associated with each concept.

The code itself documents this approach as a coarse approximation and indicates that a proper per-topic breakdown would require actual error clustering rather than the temporary level-band mapping.

### Audit finding

This mechanism serves a different purpose from direct question-level mastery evaluation.

It should therefore not automatically be treated as equivalent to the mastery calculation used for ordinary worksheet evaluation.

More importantly, using the same `conceptMastery` field for materially different calculation mechanisms creates ambiguity for downstream consumers.

---

# 5. Cross-Path Comparison

| Property                                   | Gemini Path           | Fallback Heuristic  | Diagnostic Heuristic |
| ------------------------------------------ | --------------------- | ------------------- | -------------------- |
| Deterministic                              | No                    | Yes                 | Yes                  |
| Uses question answers                      | Yes                   | Yes                 | No                   |
| Topic-specific                             | Yes                   | Yes                 | Limited              |
| Explicit mathematical rule                 | No                    | Partial             | Yes, but coarse      |
| Reproducible                               | Not guaranteed        | Yes                 | Yes                  |
| Dependent on question order                | No inherent guarantee | Yes                 | No                   |
| Represents actual topic performance        | Model interpretation  | Yes, but fragile    | Not directly         |
| Suitable as a universal mastery definition | Not established       | Not in current form | Not established      |

The central issue is therefore not that one implementation necessarily fails in every context.

The issue is that **the same business concept — `conceptMastery` — is currently being produced according to different rules depending on which execution path generated the report.**

---

# 6. Relationship With Certification

The certification engine consumes `conceptMastery` from the latest `EvaluationReport`.

The certification flow is therefore effectively:

```text
Student Assessment
       ↓
Evaluation Path
       ↓
EvaluationReport
       ↓
conceptMastery
       ↓
Certification Eligibility
```

The certification engine does not know whether the mastery value originated from:

* Gemini's judgment,
* the deterministic fallback heuristic, or
* the diagnostic level-threshold heuristic.

Consequently, a change to any upstream mastery-producing mechanism can potentially change certification eligibility.

This establishes `conceptMastery` as a **shared business contract**, rather than merely an evaluation output.

---

# 7. Main Audit Finding

The audit confirms that the platform currently lacks a single, explicit definition of what the following labels mean:

```text
Strong
Satisfactory
Needs Practice
```

The labels are shared across the application, but the mechanisms producing them are not.

This creates three risks.

## 7.1 Semantic Drift

Different parts of the application can interpret the same label differently.

For example, `Strong` may represent:

* an LLM's holistic judgment,
* the first correct answer for a topic,
* or a level-threshold condition.

These are not equivalent definitions.

## 7.2 Certification Drift

Because certification consumes the stored mastery value, changing evaluation logic can indirectly change certification eligibility.

A change intended only to improve assessment behavior could therefore alter certification outcomes.

## 7.3 Reproducibility

A deterministic application should be able to explain why a student received a particular mastery classification.

The current Gemini path does not provide a deterministic rule that can independently reproduce the model's classification.

The fallback path is deterministic but can depend on question ordering.

The diagnostic path is deterministic but uses a different, coarse-grained representation of mastery.

---

# 8. Recommended Direction

The audit recommends establishing a **single systematic business-logic definition for concept mastery**.

The responsibility should be separated into two conceptual stages.

## Stage 1 — Evaluate the Student's Responses

The evaluation layer may use the appropriate mechanism to determine whether an individual response demonstrates correctness or understanding.

For example, an AI model may be useful when interpreting natural-language or otherwise complex student responses.

The important point is that this stage produces **evaluation evidence**.

## Stage 2 — Determine Concept Mastery

A dedicated business rule should consume that evidence and determine the final mastery classification:

```text
Question-level evidence
        ↓
Per-topic aggregation
        ↓
Explicit mastery rules
        ↓
Strong / Satisfactory / Needs Practice
```

The final labels should therefore be generated according to an explicit, documented contract rather than being independently decided by multiple unrelated code paths.

---

# 9. Proposed Business-Logic Principles

The eventual mastery logic should satisfy the following principles.

### 9.1 Order Independence

Question ordering must not change the mastery result.

The following should therefore produce the same classification:

```text
Correct → Incorrect
```

and

```text
Incorrect → Correct
```

when the aggregate evidence is equivalent.

### 9.2 Topic-Level Aggregation

Mastery should be determined from all relevant evidence for a topic rather than from whichever question happens to be processed first.

Concept mastery should therefore operate approximately as:

```text
Topic
  ↓
Collect all relevant questions
  ↓
Aggregate performance
  ↓
Apply mastery rule
```

### 9.3 Explicit Thresholds

The meaning of:

```text
Strong
Satisfactory
Needs Practice
```

must be explicitly defined.

For example, a future implementation could use percentage-based thresholds, but the exact thresholds should be derived from the project's established educational/business requirements rather than introduced arbitrarily during implementation.

### 9.4 Reproducibility

Given the same evaluation evidence, the system should produce the same mastery result.

### 9.5 Auditability

The system should be able to explain why a topic received its classification.

For example:

```text
Topic: Number Sense
Correct: 8
Total: 10
Performance: 80%
Mastery: <business-rule result>
```

This makes the result easier to inspect, test, and defend.

### 9.6 Single Semantic Contract

Every downstream consumer should interpret:

```text
Strong
Satisfactory
Needs Practice
```

according to the same documented definition.

---

# 10. Certification Dependency

Because certification consumes `conceptMastery`, certification should be treated as a downstream consumer of the mastery business contract.

Any future change to:

* mastery thresholds,
* mastery aggregation,
* question-level correctness interpretation,
* evaluation/report generation,
* or diagnostic mastery generation

should trigger a review of certification behavior.

This does not mean certification should duplicate the mastery calculation.

Instead:

```text
Mastery Business Rules
        ↓
EvaluationReport
        ↓
Certification
```

should establish a single authoritative meaning for the stored mastery values.

---

# 11. Issue #400 and Drift Detection

The audit also identified the relationship with Issue #400.

There are two certification eligibility implementations:

```text
backend/src/certification.ts
```

and:

```text
backend/src/modules/certification/services/eligibility.service.ts
```

The latter represents the future/dormant certification implementation associated with the database migration direction.

The repository also contains:

```text
backend/src/__checks__/certification.check.ts
```

as a potential drift-detection mechanism.

The current audit indicates that this check should be verified and kept in a known-good state before being relied upon as a protection mechanism.

In particular, the existing `@ts-nocheck` usage should be reviewed because a drift check that does not reliably type-check or execute cannot provide strong protection against future changes.

---

# 12. Recommended Standing Practice

A lightweight standing practice should be adopted for future changes involving `conceptMastery`.

Whenever mastery calculation or evaluation-report generation changes:

1. Review the defined mastery semantics.
2. Verify the resulting `EvaluationReport` structure.
3. Verify certification's interpretation of the mastery values.
4. Run the certification drift check.
5. Confirm that existing certification requirements still correspond to the updated mastery semantics.

This makes certification an explicit downstream consideration rather than an independent system that can silently drift.

---

# 13. Scope of This Audit

This audit is intentionally focused on the **production and semantics of `conceptMastery`**.

It does not attempt to redesign:

* the entire evaluation engine,
* the certification engine,
* the database architecture,
* diagnostic assessment generation,
* or unrelated student progression behavior.

The objective is to establish the problem clearly and define the architectural direction required to make concept mastery consistent.

---

# 14. Final Conclusion

The audit confirms that `conceptMastery` is currently produced through multiple mechanisms that do not share one authoritative business definition.

The three identified paths are:

1. **LLM-generated mastery** during standard worksheet evaluation.
2. **Deterministic fallback mastery** based on per-question correctness.
3. **Diagnostic level-threshold mastery** based on coarse level bands.

Although all three produce the same labels, their underlying semantics differ.

The most important architectural requirement identified by this audit is therefore to establish **one systematic business-logic layer for determining concept mastery**.

The intended separation should be:

```text
Student Response
       ↓
Evaluation / Evidence
       ↓
Systematic Concept-Mastery Business Rules
       ↓
Strong / Satisfactory / Needs Practice
       ↓
EvaluationReport
       ↓
Certification
```

The evaluation mechanism may continue to use AI where interpretation of a student's response requires it. However, the final classification of concept mastery should be governed by explicit, documented, testable business rules rather than independently produced by multiple code paths.

This would provide:

* deterministic and reproducible results,
* order-independent topic evaluation,
* auditable mastery decisions,
* consistent semantics across the application,
* and a stable contract for certification.

The audit therefore recommends that **concept mastery be treated as a first-class business rule with a single authoritative definition**, and that future changes to its calculation be considered changes to a downstream certification dependency.

No implementation change to the mastery calculation is proposed as part of this audit itself. The next implementation step should first establish and confirm the exact mastery semantics and thresholds with the project's existing competency requirements before replacing the current mechanisms.
