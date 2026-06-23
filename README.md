# FLN — Foundational Literacy and Numeracy

A structured, competency-based framework for foundational mathematics learning and assessment, aligned with India's national education initiatives and informed by state-level curriculum research.

This repository contains the **23-level learning progression**, level-wise question specifications, research and reference documents, diagnostic worksheet generators for Classes 1–3, and planning materials for assessment design and automation.

---

## What Is the FLN Project?

The FLN project develops a **level-based foundational numeracy system** for early-grade learners (Classes 1–3). Rather than relying on a single end-of-year examination, the framework:

- Breaks numeracy into **23 sequential learning levels**, each focused on one core concept.
- Uses **main levels and sub-levels** so students demonstrate mastery before advancing.
- Aligns content with **NIPUN Bharat**, **NCERT learning outcomes**, **PARAKH** competency benchmarks, and **state board curricula**.
- Incorporates **child psychology and cognitive development** principles into question design and difficulty progression.
- Provides **randomized HTML worksheet generators** for classroom practice and diagnostic use.

The project is developed as part of the **VISE Interns** initiative and is intended for use by educators, curriculum designers, and researchers working on foundational learning in India.

---

## Purpose of Foundational Literacy and Numeracy

**Foundational Literacy and Numeracy (FLN)** refers to the essential reading, writing, and mathematical skills every child should acquire in the early years of schooling.

This repository focuses on **Foundational Numeracy** — the ability to reason and apply simple numerical concepts in daily life. As documented in [`resource.md`](resource.md), foundational numeracy includes:

- Understanding quantities and the concepts of *more*, *less*, and *equal*
- Establishing relationships between single items and groups
- Using symbols to represent quantities
- Comparing, ordering, and sequencing numbers
- Visualising shapes and spatial relationships

The framework builds on pre-number concepts children already encounter at home — counting toys, comparing portions, and matching groups — and extends them through structured, activity-based progression. It draws on national programmes including **NIPUN Bharat**, **Vidya Pravesh**, **NISHTHA FLN**, **DIKSHA**, **PARAKH**, and **ASER** benchmarks.

Research in the repository emphasises that comparison is the foundation of numeracy (as noted in Piaget's work on number conception): before children can count or conserve quantity, they learn to compare groups visually. Level 1 of this framework begins with that principle.

---

## The 23-Level Learning Structure

The learning path is organised under [`FLN Levels Structure/`](FLN%20Levels%20Structure/). Each level directory contains:

| File pattern | Role |
|---|---|
| `Level N_<Concept>.md` | Level overview — objective, description, learning outcomes |
| `N.0.md` | **Main level** — the mastery checkpoint; students must clear this before advancing |
| `N.1.md`, `N.2.md` | **Sub-levels** — the same concept presented in an easier, more accessible way for scaffolding or remediation |

### Design principles

From project meeting notes ([`minutes_of_meeting.md`](minutes_of_meeting.md)):

- **One concept per level** — cognitive load is kept light; each level addresses a single idea.
- **Sub-levels reframe, not replace** — sub-levels present the same concept in a simpler form rather than introducing new topics.
- **Comparison stays at Level 1** — quantity comparison (=, <, >) is the entry point; numeral comparison appears later (Levels 10 and 21).
- **Review assessments** at Levels 11 and 23 consolidate prior learning with a balanced difficulty mix (approximately 50% easy, 35% moderate, 15% hard).

### Progression overview

| Range | Focus |
|---|---|
| Levels 1–5 | Pre-number and early number sense: comparison, classification, matching, numbers 1–10, finger counting |
| Levels 6–11 | Sequencing, operations (addition/subtraction within 10), patterns, numeral comparison, review |
| Levels 12–17 | Place value, numbers 11–30, counting/tracing, sequencing (1–30), addition and subtraction (1–30) |
| Levels 18–22 | Ordering, numbers 31–50, skip counting, comparison and ordering (1–50) |
| Level 23 | Comprehensive review assessment |

See [`LEVELS_INDEX.md`](LEVELS_INDEX.md) for the complete level table with concept names and descriptions.

A planned automation pipeline for creating new levels is documented in [`FLN Levels Structure/automate.md`](FLN%20Levels%20Structure/automate.md).

---

## Important Documents

### [`resource.md`](resource.md)

A research and reference compendium covering:

- National FLN initiatives (NIPUN Bharat, Vidya Pravesh, NISHTHA FLN, DIKSHA, PARAKH, Jaadui Pitara)
- Child psychology principles for early numeracy (cognitive, socio-emotional, and motivational development)
- State-wise FLN implementation examples (Telangana, Tamil Nadu, Sikkim, Punjab, Odisha, Nagaland, Karnataka, Himachal Pradesh, Jharkhand)
- Question difficulty guidelines (pattern recognition, comparison, counting, addition, skip counting, yes/no questions)
- An **error analysis framework** mapping error types (recognition, counting, sequence, place value, addition, subtraction, skip counting, pattern, word problem) to underlying competency gaps
- Foundational numeracy pedagogy notes and useful textbook references

### [`Metric.md`](Metric.md)

Defines the **competency-based evaluation approach** for the project:

- Alignment with NIPUN Bharat, NCERT learning outcomes (IL/ILM strands), PARAKH, and ASER arithmetic benchmarks
- Holistic competencies beyond recall: decision-making, organising, communication, curiosity, and inquiry
- Planned metrics where student competency is judged by **reasoning patterns**, not just correctness (e.g., a place-value error vs. a careless mistake)
- Principles for re-evaluation when a student misses an easy question but answers harder ones correctly
- Guidance to assess students by the **highest task they can perform independently**

### [`State-Wise-Data.md`](State-Wise-Data.md)

A comprehensive **Mathematics curriculum analysis** for Classes 1–4 across 29 Indian states and union territories (June 2026). It includes:

- Methodology: 14-dimension analytical framework and FLN alignment scoring (1–10)
- State-by-state curriculum summaries, strengths, weaknesses, and FLN readiness
- Comparison tables for number range, arithmetic, geometry, measurement, data handling, and activity level
- NIPUN Bharat benchmark alignment and NEP 2020 pedagogical alignment
- Cross-state rankings, regional patterns, and recommendations for curriculum designers and FLN implementers
- Links to state-wise syllabus spreadsheets and Class 1–3 FLN criteria documents

### [`minutes_of_meeting.md`](minutes_of_meeting.md)

The official record of project meetings (June 2026) covering:

- Project management, task delegation, and reporting workflows
- Syllabus documentation and comparative state analysis plans
- Assessment design: question banks, competency mapping, student profiling
- Level creation guidelines and team responsibilities
- GitHub repository architecture, Markdown documentation standards, and web interface plans
- Presentation requirements for curriculum analysis, level framework, question generation, LLM automation, and evaluation metrics

---

## HTML Worksheet Generators

Three self-contained HTML files generate randomized, printable practice worksheets. Open any file in a modern web browser — no server or installation required.

| File | Class | Description |
|---|---|---|
| [`class1_fln_worksheet (1).html`](class1_fln_worksheet%20(1).html) | Class 1 | Math practice worksheet with 9 sections (matching, comparison, measurement, fractions, word problems) |
| [`class_2_qp.html`](class_2_qp.html) | Class 2 | Mathematics practice worksheet with 11 sections (missing numbers, counting, sequencing, operations, place value, patterns) |
| [`Class3_Math_FLN_ExamPaper.html`](Class3_Math_FLN_ExamPaper.html) | Class 3 | FLN exam paper with 12 sections (numbers, comparison, shapes, patterns, operations, measurement, time, money, ordering) |

### How to use

1. **Open the file** in Chrome, Firefox, Edge, or Safari.
2. **Set the number of sets** using the input field in the toolbar (default: 5; range: 1–100).
3. Click **Generate** (or **Generate Sets** for Class 3) to create randomized question sets.
4. **Switch between sets** using the tab bar that appears above the worksheet.
5. **Print** the current set using **Print current set** / the print button. Worksheets are formatted for **A4, black-and-white** printing.
6. **Export** (optional):
   - **Class 1 and Class 2:** **Download All Sets (separate PDFs)** — exports each set as an individual PDF file (uses html2canvas, jsPDF, and JSZip via CDN).
   - **Class 3:** **Download All as HTML (Multi-Tab)** — exports all sets as a single HTML file with tabs.

Each generation produces different randomized values, making the tools suitable for repeated classroom use without duplicate papers.

---

## Repository Structure

```
fln/
├── README.md                          # This file
├── LEVELS_INDEX.md                    # Quick reference for all 23 levels
├── CONTRIBUTING.md                    # Contribution guidelines
├── resource.md                        # Research and reference material
├── Metric.md                          # Competency evaluation framework
├── State-Wise-Data.md                 # State curriculum analysis
├── minutes_of_meeting.md              # Project meeting records
├── class1_fln_worksheet (1).html      # Class 1 worksheet generator
├── class_2_qp.html                    # Class 2 worksheet generator
├── Class3_Math_FLN_ExamPaper.html     # Class 3 exam paper generator
└── FLN Levels Structure/
    ├── automate.md                    # Level creation automation pipeline
    ├── image/                         # Diagrams and assets
    └── Level 1/ … Level 23/           # Level definitions and sub-levels
```

---

## Future Roadmap

The following items are documented in project planning materials and represent planned — not yet fully implemented — work:

### Assessment and tracking
- Excel-based **question bank** with answer keys and competency mapping for every question paper
- **Individual student profiles** tracking performance, competency levels, progression history, and remediation needs
- Topic-level mastery evaluation rather than single cumulative examinations
- **Error analysis framework** applied systematically to student responses

### Content expansion
- New levels covering identified **gaps**: shapes, measurement, money, time, and data handling (noted in [`automate.md`](FLN%20Levels%20Structure/automate.md))
- Continued alignment with **state board and CBSE textbooks**
- Expanded question bank with regional language support

### Automation and tooling
- **Level creation pipeline** — AI-assisted drafting, review loop, and ZIP export matching the repository folder structure ([`automate.md`](FLN%20Levels%20Structure/automate.md))
- **RAG pipeline** for automated retrieval of question illustrations
- LLM-assisted workflows for book extraction, concept identification, question generation, and personalised learning pathways
- **Web interface** with a tabbed layout for browsing level-wise questions

### Research and quality
- Comparative analysis of state syllabi against level-wise content
- Psychology-informed review as a final quality filter for question design
- Competency metrics evaluating reasoning, difficulty balance, and concept coverage (see [`Metric.md`](Metric.md))

---

## Contributing

We welcome contributions from educators, researchers, and developers. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) for details on forking, branching, naming conventions, and the pull request process.

---

## License

No license file is currently specified in this repository. Contact the project maintainers before reusing or distributing content.
