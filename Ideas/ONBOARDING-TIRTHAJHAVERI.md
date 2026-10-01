# Onboarding Document - Rachit Verma

## 1. What is FLN?

FLN (Foundational Literacy and Numeracy) is an educational platform designed to address the learning crisis in primary education. It targets early-grade students who may have gaps in basic reading, writing, and mathematical skills. By providing structured assessments, evaluation, and learning-gap identification, FLN helps educators understand where a student is struggling and provide appropriate support to improve their foundational skills.

## 2. What do you understand by FLN (as a system)?

FLN is a comprehensive, multi-tiered assessment and tracking system:

* **Users:** The system serves multiple roles. Superadmins and State/District/Block Administrators oversee regional progress and manage the system. Teachers and Volunteers are the primary ground-level users who manage students, conduct assessments, and record progress. Students are the end-users whose learning outcomes are tracked.

* **Main Entities:** The core entities include Schools, Classes, Students, Questions, Worksheets, Evaluation Reports, Competencies, and Remediation Data.

* **Data Flow:** Teachers or Volunteers register students into specific classes. The system generates diagnostic worksheets based on the student's current FLN level. Once the student completes the worksheet, the answers are evaluated either manually or through AI/ICR scanning. An evaluation report is generated that identifies the questions answered incorrectly and the corresponding learning gaps. These gaps are then used by the remediation engine to generate targeted practice questions and concept explanations. The remediation information can be viewed by the teacher and used for further student practice.

## 3. Current State of the Repository — What is Done So Far

* **Tech Stack:**

  * **Frontend:** React with TypeScript, Vite, Tailwind CSS, Axios, and Lucide React for icons.

  * **Backend:** Node.js with Express and TypeScript.

  * **Database:** MongoDB Atlas for production, with local database support for development and testing.

  * **Authentication:** JWT-based token authentication with bcrypt for password hashing.

  * **Assessment/Evaluation:** Python-based ICR scanning for processing student answer sheets.

  * **AI:** Gemini-based question generation and remediation generation.

* **Implemented Features:**

  * Role-Based Access Control (RBAC) with distinct dashboards for different user types.

  * Automated generation of personalized diagnostic worksheets using AI.

  * Student management, including registration and profile tracking.

  * Evaluation reports showing student performance at the question level.

  * ICR-based scanning and evaluation of student answer sheets.

  * Competency-based identification of student learning gaps.

  * Remediation generation based on incorrectly answered questions and their associated concepts.

  * Printable remediation sheets containing concept explanations and targeted practice questions.

  * Analytics dashboards with geographical and performance information.

## 4. Gaps Observed in the Code

1. **Lack of an Integrated Remediation Workflow:**

   * **Where:** Evaluation report, remediation generation flow, database layer, and frontend report/remediation components.

   * **What:** The system could evaluate student answers and identify incorrect questions, but there was no complete workflow to automatically convert those incorrect answers into targeted remediation content.

   * **Why it matters:** Identifying that a student answered a question incorrectly is only the first step. Teachers also need to know which concept the student is struggling with and receive suitable practice questions to help address that learning gap. Without an integrated remediation workflow, the teacher would have to manually determine what to teach and which questions to provide.

2. **ICR Evaluation Performance Issues:**

   * **Where:** Python-based ICR evaluation and scanning workflow.

   * **What:** The evaluation process contained an early-return issue that could cause unnecessary timeouts and retries during scanning.

   * **Why it matters:** Slow or unreliable evaluation directly affects the teacher's workflow. The scanning process needs to provide evaluation results quickly so that the teacher can immediately view the student's performance and proceed with remediation.

## 5. Ideas for the Project

1. **Data-Driven Remediation System:**

   * **What:** Create a structured remediation system where concepts, question mappings, generator configurations, and visual templates are maintained in MongoDB.

   * **Why:** Remediation should be based on the actual competencies and concepts defined for the FLN curriculum rather than relying on hard-coded or dummy practice questions.

   * **How:** Use collections such as `remediationConcepts`, `generatorConfigs`, `visualTemplates`, and `questionConceptMappings` as the source of truth. The remediation engine can use these configurations to identify the appropriate concept and generate relevant practice questions for the student.

2. **Improved Evaluation and Remediation Flow:**

   * **What:** Connect the evaluation report directly with remediation generation.

   * **Why:** Once an incorrect answer is identified, the system should automatically provide the teacher with the relevant concept, explanation, and practice questions.

   * **How:** Map incorrect questions to their corresponding competencies, pass the identified learning gaps to the remediation engine, generate targeted questions, and display the results through the evaluation report and printable remediation sheet.

## 6. Your Contribution

During my onboarding, I worked on the **Remediation Engine, Evaluation Report improvements, and ICR scanning optimization** to create a more complete workflow from student evaluation to targeted practice.

* **Remediation Engine:** Implemented the remediation generation workflow that identifies incorrectly answered questions and maps them to the corresponding competency or concept. The engine then generates targeted practice questions based on the identified learning gap.

* **MongoDB-Based Remediation Architecture:** Added support for remediation-related MongoDB collections including `remediationConcepts`, `generatorConfigs`, `visualTemplates`, and `questionConceptMappings`. This ensures that remediation data and configurations are maintained through the database rather than relying on dummy or hard-coded data.

* **Evaluation Report Integration:** Integrated remediation information with the evaluation report so that teachers can view question-level results and continue from an incorrect question to the corresponding remediation content.

* **Remediation UI:** Added frontend components for displaying remediation generation status, remediation notes, and practice questions. The remediation workflow provides the teacher with the student's missed question, relevant concept, explanation, and similar practice questions.

* **Printable Remediation Sheet:** Implemented the printable remediation experience containing student information, question/concept details, correct answer, concept explanation, and targeted practice questions. The student's original answer is intentionally not included in the remediation sheet.

* **Asynchronous Evaluation Processing:** Updated the scan submission workflow so that secondary evaluation and file-writing operations do not unnecessarily block the main API request, improving the responsiveness of the evaluation process.

* **Remediation Generation Tracking:** Added tracking for the remediation generation workflow so that the system can maintain the state of a remediation request through stages such as creation, generation, and completion/failure.

* **UI and Report Improvements:** Worked on the evaluation and remediation report experience to make the generated information easier for teachers to understand, review, and print for student practice.

Overall, my contribution focused on connecting **student evaluation with personalized remediation**, so that the system not only identifies a student's learning gap but also provides targeted practice to help address that gap.
