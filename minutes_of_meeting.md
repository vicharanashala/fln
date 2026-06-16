# Minutes of Meeting

## Purpose
This section records the discussions, decisions, feedback, and action items from meetings with mentors, stakeholders, and team members. It serves as the official record of what was discussed, agreed upon, and assigned during each meeting.

---

## Date: 04 June 2026
**Attendees:** Jinal Ma'am, FLN Team

### Project Management & Setup
- **Daily Tracking:** Create a Zoho Project workspace for task management and documentation. Team members should log and file work completed at the end of each day.
- **Task Delegation:** Divide workload appropriately among team members based on project requirements and expertise.
- **Reporting:** Submit weekly progress updates to Jinal Ma'am. Maintain visibility of completed, ongoing, and pending tasks.
- **Technical Integration:** Set up and utilize OpenCode for development workflows. Integrate Gemini API key for AI-assisted features and experimentation.

### Syllabus & Documentation
- **Syllabus Presentation:** Create a presentation-ready Google Docs version of the FLN syllabus. Organize content level-wise and ensure readability for stakeholder review.
- **Comparative Analysis:** Collect foundational learning and numeracy syllabi from multiple Indian states. Use Claude AI to generate a comparative analysis report. Identify common learning outcomes and progression patterns. Begin analysis using the simplest syllabus structure first.
- **Data Structuring:** Review ASER 2024/2025 reports. Use insights from ASER learning benchmarks and assessment frameworks to guide curriculum structure and sheet organization.

### Assessment & Standards
- **Question Management:** Create an Excel-based Question Bank. Develop a matrix for every question paper. Include answer keys and competency mapping for each question.
- **FLN Evaluation Framework:** Ensure FLN standards remain applicable across different state curricula. Evaluate mastery at the topic level rather than relying on a single cumulative examination. Maintain alignment with foundational numeracy competencies.
- **Student Tracking:** Create individual student profiles. Track performance, competency levels, progression history, remediation requirements, and assessment outcomes.

---

## Date: 08 June 2026
**Attendees:** Jinal Ma'am, FLN Team

### 1. General Guidelines & Collaboration
- **Source Material:** Refer strictly to the designated book(s) when creating questions.
- **File Management:** Keep all content consolidated within one single Google Doc.
- **AI Tooling Restriction:** Avoid using LLMs (Large Language Models) during the initial idea phase.
- **Team Dynamics:** Focus on increased collaboration across the entire team.

### 2. Workflow Pipeline & Responsibilities
The task pipeline progresses through the following designated roles:
- **Shreya:** Responsible for creating the assessment matrix.
- **Sejal:** Responsible for researching/mapping how a child thinks.
- **Prajakta:** Assist Arnab and Aman with simplifying questions.
- **Arnab & Aman:** Responsible for the final creation of the questions.

### 3. Question Design & Leveling Strategy
- **Comparison Concepts:** Comparison (=, <, >) must be kept strictly at Level 1. Merge any levels which appear so similar.
- **Research Action Item:** Investigate why comparison is chosen for the 1st level instead of other concepts.
- **Level Structure:**
  - **Level:** Focus on 1 concept only, keeping the cognitive load light.
  - **Sublevel:** Present the same concept but framed in an easier, more accessible way.
- **Question Formats:** Use Matching Questions instead of designing separate, individual equivalence questions.

### 4. Document Structure Updates
- **New Addition:** Add a dedicated Summary Tab to the primary project document.

---

## Date: 09 June 2026
**Attendees:** Jinal Ma'am, FLN Team

### Overview & Updates
- **Team Status:** The team shared their respective project updates.

### Action Items
- **Question Refinement:** Format all regional language questions clearly in English.
- **Data Gathering:** Continue to gather and expand with more questions.
- **Documentation:** Transfer and upload the relevant project documents into NotebookLM if the document is very long.

---

## Date: June 11, 2026
**Attendees:** Jinal Ma'am, FLN Team

### Overview & Updates
- **Team Updates:** Team members provided progress updates.
- **Curriculum Alignment:** The system content should align with State board and CBSE textbooks mainly.

### Key Discussion Points
#### 1. System Automation
- **RAG Pipeline:** Ma'am suggested exploring building a Retrieval-Augmented Generation (RAG) pipeline to automate the system of Web-scraping question illustrations, as in future the demand will rise, manually looking for them is inefficient.

#### 2. Content & Question Optimization
- **Question Structuring:** Group/club similar topic questions together where possible, and add more levels for topics that require extra emphasis.

---

## Date: 15 June 2026
**Attendees:** Jinal Ma'am, FLN Team

### 1. Key Discussion Points

#### A. Documentation & GitHub Workflow
- **Repository Architecture:** A structured folder system must be established in the GitHub repository. All core text documents must be created as Markdown (.md) files.
- **Project Journaling:** Project logs and journals must be maintained strictly in Markdown (.md) format to ensure cross-platform compatibility and clean versioning.
- **Version Control Tracking:** A standard process needs to be finalized to export the complete version history as an .md file. This export must also include the direct link to the corresponding Google Doc.

#### B. Web Interface & Content Management
- **Webpage Design:** The main webpage interface will feature a tabbed layout. Each tab will be dedicated to displaying specific questions.
- **File Separation:** Individual questions or data sets must be managed within separate .md files rather than a single monolithic file.

#### C. Assessment Design & Evaluation (FLN Test)
- **Test Architecture:** Reviewing the foundational logic of the FLN (Foundational Literacy and Numeracy) test. If it is verified as a strictly level-based assessment, each student must receive a separate, randomized question set.
- **Quality Assurance:** The evaluation rubric for reviewing and grading the question paper needs to be formally submitted to the supervisor/reviewer.

#### D. Upcoming Presentation Requirements (Saturday, 20th June)
The upcoming project presentation must follow a standardized structure, limiting allocation to 1–2 slides per team member. The slide deck must cover:

- **Problem Statement:** Clearly defining the core challenge.
- **Pipeline:** Outlining the technical/operational workflow.
- **Progress:** Highlighting achievements and current status.

The presentation should address the following questions:

1. **Curriculum Analysis**
   - How have you analyzed the Mathematics syllabus from Classes 2–5?
   - How have you divided the syllabus into concepts, sub-concepts, and levels?

2. **Level Creation Framework**
   - Methodology used to define learning levels.
   - How were you mapping the concepts to difficulty levels?
   - Justification of the progression structure.

3. **Question Bank Generation**
   - Approach for generating question banks.
   - Types of questions included. (Can we include yes/no questions and then analyze the student's behaviour? How simple or difficult can the questions become to monitor learning patterns?)

4. **LLM-Based Automation**
   - How can Large Language Models (LLMs) automate:
     - Book/content extraction
     - Concept identification
     - Level creation
     - Question bank generation by book scraping (Which SMLs/LLMs/models can be used to scrape books fast?)
     - Question evaluation (How can LLM be used to do personalized profiling and give the next question based on previous answers?)
     - Personalized learning pathways

5. **Student Assessment Framework**
   - How can we determine what a student already knows?
   - How can we identify knowledge gaps?
   - How can we estimate mastery of a concept?

6. **Evaluation Metrics**
   - Metrics proposed for evaluating:
     - Question quality
     - Difficulty level
     - Concept coverage
     - Student understanding
     - Learning progress

7. **Prototype or Demonstration**
   - Any working proof of concept, architecture, workflows, automation pipelines, or experiments conducted.

---

*Generated from meeting notes: 04, 08, 09, 11, 15 June 2026*
