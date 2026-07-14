# FLN Foundation Concepts

## Table of Contents

- [1. What is FLN?](#1-what-is-fln)
- [2. NIPUN Bharat Mission](#2-nipun-bharat-mission)
- [3. Foundational Numeracy — Definition (NIPUN Bharat, pg. 84)](#3-foundational-numeracy--definition-nipun-bharat-pg-84)
- [4. Grade-wise Lakshya (Targets) for Foundational Numeracy](#4-grade-wise-lakshya-targets-for-foundational-numeracy)
- [5. Relevance to Our Project](#5-relevance-to-our-project)

## 1. What is FLN?

Foundational Literacy and Numeracy (FLN) is the ability of a child to read with comprehension and perform basic arithmetic operations, expected to be achieved by the end of Grade 3 (age ~8–9). It is treated as the precondition for all later learning — NEP 2020 frames it as an urgent national mission, with the rest of schooling only becoming effective once this base is secured.

## 2. NIPUN Bharat Mission

**NIPUN Bharat** = National Initiative for Proficiency in Reading with Understanding and Numeracy.

- Launched: **5th July 2021**, by the Department of School Education and Literacy, Ministry of Education.
- Vision: universal acquisition of FLN so every child reaches desired competencies in reading, writing, and numeracy by end of Grade 3, **by 2026–27**.
- Implemented under the **Samagra Shiksha** scheme.
- Core components:
  - State-specific FLN targets
  - Enhanced teacher training
  - School readiness programs
  - Digital tracking systems
  - Mother-tongue/home-language medium of instruction
  - Activity-based, play-based, discovery pedagogy
  - Every state required to make its own FLN action plan

## 3. Foundational Numeracy — Definition (NIPUN Bharat, pg. 84)

Foundational Numeracy = the ability to reason and apply simple numerical concepts to daily-life problem solving, built on **number sense** and **spatial understanding**. It includes the ability to:

1. Understand quantities
2. Grasp concepts like more/less, larger/smaller
3. Relate single items to groups of items (7 = a group one more than a group of 6)
4. Use symbols representing quantities (7 = "seven")
5. Compare numbers (10 > 8; 3 is half of 6)
6. Order numbers in a list (1st, 2nd, 3rd...)
7. Visualize shapes and space

Key building-block skills called out explicitly:
- **Classification** — grouping by shared characteristics; start with one property (colour/size/shape), increase complexity gradually.
- **Seriation** — ordering objects by a rule (e.g. bigger→smaller), understanding transitivity (A>B, B>C ⟹ A>C). Start with 3 objects, increase gradually.
- **One-to-one correspondence** — matching/pairing objects; foundation for "many/few," "more than/less than," "as many as."

## 4. Grade-wise Lakshya (Targets) for Foundational Numeracy

| Stage | Key Numeracy Targets |
|---|---|
| **Balvatika / Age 5–6** | Counts & correlates numerals to 10; recognizes/reads numerals to 10; compares two groups (more/less/equal); arranges by sequence; classifies objects by observable characteristics; uses comparative vocabulary (longer/shorter, heavier/lighter, etc.) |
| **Class I / Age 6–7** | Counts objects to 20; reads/writes numbers to 99; adds & subtracts to 9 in daily contexts; describes 3D shape properties (corners, edges, surfaces); estimates length (non-standard units — hand span, footstep) and capacity (cup, spoon, mug); creates/recites poems using shapes & numbers |
| **Class II / Age 7–8** | Reads/writes numbers to 999; adds & subtracts to 99; performs multiplication as repeated addition, division as equal sharing; builds tables of 2, 3, 4; estimates length/capacity with non-standard uniform units (rod, thread, cup); identifies 2D shapes (rectangle, triangle, circle, oval); uses spatial vocabulary (far/near, above/below, front/behind); creates/solves simple riddles with numbers & shapes |
| **Class III / Age 8–9 ★ (MPL gate)** | Reads/writes numbers to 9999; solves daily problems with addition/subtraction to 999; builds tables 2–10, uses division facts; measures length/weight/capacity in standard units (m, km, g, kg, litres); relates 2D shapes to 3D shapes; reads calendar dates/days, reads clock in hours & half-hours; identifies half/one-fourth/three-fourth of a whole and of a collection; identifies, extends, and communicates rules for simple number/event/shape patterns |

## 5. Relevance to Our Project

- These Lakshya targets are the **direct source material for our platform's FLN competency/level definitions** (Classes 2–4 curriculum stored as Markdown per level, §1.4 of SRS). Each Lakshya bullet can become a tagged competency in the Worksheet JSON schema (one question ↔ one competency).
- The **Balvatika/Class I targets** give the "previous class syllabus" baseline our **Baseline Assessment** must cover for newly enrolled Class 2 students.
- The classification/seriation/one-to-one correspondence skills are pre-numeracy building blocks — useful for constructing **easier band questions** within a level, before progressing to abstract number operations.
- Since the platform is Math-FLN-only (no Literacy, §1.4), this file isolates exactly the numeracy-relevant targets for curriculum authoring, skipping literacy Lakshyas.