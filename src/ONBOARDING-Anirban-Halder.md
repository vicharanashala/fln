


1.
## What is FLN?##
FLN i.e. Foundational Literacy and Numeracy/education is a  open source platform for teachers where they can set  question paper according to the current level of students' understanding  and return with the  exam result with proper diagnosis such that a student leans on concept rather than marks , providing areas required to improve /constructive feedbacks . It helps the teacher to segregate the problem the students' facing in  learning a concept thus help in deciding the approach required to make them understand clearly.


2.
## What do you understand by FLN (as a system)?##
FLN works as coordinated system .Following are the breakdowns in different levels

1) As a student one can authorise giving credible information(Aadhaar) required by the platform, can give test according to their academic level;result is provided interms of  constructive ananlysis and suggestion to improve the weak areas not marks .

2) As a teacher he/she has to register a student/school using student id/adhar or provide their school id , address,block,district,state such that they can access  personalise student worksheet both in interactive and print level. Teachers can also upload the answer scripts and can obtain personalised interactive  feedback for each answer scripts .

3) Superadmin Dashboard  contain all the information including student email, school name ,id , district, state , school strength, coordinator id,  etc..  . Once user uploads their school name or registers in the platform , the name gets  added in the school list or gets registered


4)There are classes(academic levels) made , from preschool 1 to class 4 . Different class has different difficulty of question to test out their numeracy accordingly

5) For certification ,their specific skills (verbal/pictorial/decomposition/numeric operation/pattern recognition) is vividly tested, if the performance or satisfactory in some specific cases then they are allowed the certificate else need to improve and attempt again.







3. ## Current State of the Repository — What Has Been Done So Far:##
Frontend: React, TypeScript, Vite, Tailwind.

Backend: Node.js, Express, TypeScript.

Database: MongoDB with local JSON fallback.

Authentication: JWT, bcrypt, role-based access.

AI/OCR: Python services, Gemini, OCR, scan processing.

Features: Student management, role dashboards, personalized worksheets, PDF/OMR generation, scanned-answer evaluation, analytics, certification, and remediation.

Roles: superadmin, Admin, District Admin, Block Admin, School, Teacher, and Volunteer.


4.
## Gaps Observed in the Code##

1) D1.3 — Q-Matrix: which questions test which skills? \[**FROM THE INTERN-READY LINK**:-https://github.com/vicharanashala/fln/issues/478].Lacks proper question for testing skills and subskills in terms of mathematics and help the student grade his/her knowledge on the mathematics he or she has learned

## file path ##- 
backend/src/data/question_template.csv & backend/src/data/question_template_importer.csv

## what's done ## -
Generated 40 question for testing skills (verbal/pictorial/decomposition/numeric operation/pattern recognition) along with marking th difficulty level as 1.2.3 for easy, medium , hard respectively, provided category to the question like direct/ real world along with representation types  which include symbolic ,verbal, equation completion,fraction,pictorial etc in normalised join table format,added question templeted in question_template.csv 

## Why it matters ## — 
To test if a student can identify pattern solve word problems, deduce information and solve problems , along with numerical operation.

2) ## GAPS in issue#750 ##
 An automatic accessibility check (axe-core 4.10.2) on the signed-in app found three critical problems and one serious one:

  a) select-name (critical): the six filters on the superadmin dashboard and the three on the Schools screen are <select> elements whose visible <label> is not connected to them, so a screen reader announces only "combo box".

  b) label (critical): the "Urgent Email" checkbox has no label.

  c) button-name (critical): the notification bell is a button with only an icon.

  d) color-contrast (serious): the small grey labels use #62748e on #0f172b, a ratio of 3.74:1. The minimum is 4.5:1.

## file path ## - frontend/src/components/panels/SchoolsPanel.tsx,
## file path ## - frontend/src/components/SuperAdminExecutiveDashboard.tsx
## file path ## -frontend/src/components/dashboards/SuperadminDashboard.tsx
## file path ## -frontend/src/components/Layout.tsx
## file path ##-  frontend/src/components/Layout.tsx

##  whats done ##- 
In resolving  the issue#750 , the changes are done exactly what was suggested by the maintainer, with the exact line of codes given . The codes are changed/added in the above files , check in the pr#851

3) ## Gaps in issue#739 ##-
  a) The certification queue (GET /api/certifications with no studentId) returns every certification in the country to any state admin.

  b) Two admins can confirm or revoke the same certification at the same time and both get 200. On the live audit, an Andhra Pradesh state admin saw and confirmed a Tamil Nadu child's certification, and eight simultaneous decisions all returned 200.

## file paths##
1. backend/src/db.ts, updateCertificationIfVersion
2. backend/src/routes/certification.ts

## whats done ##
In resolving the issue#739,the changes are done exactly what was suggested by the maintainer, with the exact line of codes given . The codes are changed/added in the above files , check in the pr#853





5. ## Ideas for the Project: ##

a. Paired “near-miss” questions:
 What: Present two almost-identical problems that differ in one important feature—for example, an addition problem with and without regrouping.

 Why: Comparing the answers can reveal whether a student understands the key concept or is relying on a memorized procedure.

 How: Link question templates as pairs and compare the student’s responses to identify which feature caused difficulty

b.Capture the student’s working, not just the answer:
 
 What: Design selected questions with space for intermediate steps, such as showing tens and ones before adding.
 
 Why: The same wrong answer can come from different misunderstandings; the working can help distinguish them.

 How: Add structured working areas to printable templates and let teachers or scanning tools record step-level results alongside the final answer.


c.Question wording and language variants:
 What: Provide approved versions of a question using simpler wording or a familiar local context while testing the same skill.

 Why: A student may understand the math but struggle with the language or context used in the question.

 How: Link wording variants to one skill and difficulty, then let teachers select an appropriate version without changing the assessed math concept.


6.
##  Your Contribution:##

## NEW FEATURE ADDED: ##
1) In  #pr907 
Added 40 question in question_template.csv of different representation and leveled the toughness ,  .Tested , as output obtained a normalised join table in csv format 

2) In frontend part in pr#851
  a) schoolsPanel.tsx  state , block,district aria-label are implemented.

  b) SuperAdminExecutiveDashboard.tsx ,arial-label like time horizon,school type,grade band,education board etc... are added.

  c)SuperAdminExecutiveDashboard.tsx arial-label urgent email added

  d)Layout.tsx aria-label Notifications added
  
  
3) In backend part in pr#853
  
  a)db.ts: updateCertificationIfVersion now bumps version on every successful update ($inc: { version: 1 } in the DB path, +1 in the in-memory path). That makes the “concurrent modification” check work, so one request wins (200) and the rest get 409.

  b)certification.ts: The queue (GET /api/certifications) now filters results with canAccessStudent, so a state admin sees only their own state’s certifications. Superadmins still see all.
  
 c)Review route: It needs no change, since it already checks access and is covered by #737, which this issue depends on.

