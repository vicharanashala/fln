**1) What is FLN?**


*Ans:* FLN stands for foundation literacy and numeracy,an open source AI powered platform, it basically is platform which can be used with various roles to help in evaluation of fountational learning of students in pre-schooling. So, when students move forward in schooling they do not struggle with subjects that are based upon foundational mathematics. So, FLN is base on which the building is built for students.

It operates in educational domain, here we aim to evaluate pre-schooling students to help learn the foundational concepts of mathematics by evaluating them 3 times in an acdemic year. The worksheets, question papers and automated evalation alongwith level wise progression helps students build a strong base as they are personalized and cerifcates are also given for cleared grades.


**2) What do you understand by FLN(as a system)?**


*Ans:* FLN is a platform which has different user roles which serves different purposes namely:

*Student*: Everyone has their own personalized profile where they have their levels, past performance history and all. They can also check how they have progressed over time so its a local testamony which tracks a single individual with this student dashboard. They have a unique identification no as well, aadhar/birth details are collected and stored in masked/hashed format.

*Teacher*: They are the backbone of whole system, as they have to perform the assessment of students in their school. They can generate paper for the whole class with student id tagged on each paper, they can evaluate the papers by scanning them, also in the end they can view analytics and certifcations student-wise. The teacher can see how the class is performing in that FLN test, they can see for individual students as well. So they get to manage overall class and are the most vital part of system. They can generate for new class as well and the system generates paper based on a standard level of that class. They evaluate by scanning them and the FLN platform auto-evaluates them and gives result. Now, the data of results can be reviewed by teacher after evaluation, if a student clears that level he/she gets a certificate for that grade or we can say they clear a benchmark. If they cannot clear, then a re-assessment is scheduled with personalized lower level for those students.

*Administrator*: They are ones who handle the schools on higher levels:

- BLOCK ADMIN: They handle every school in their block area, can see how the schools are performing in his block. Ensure that FLN assessments are regularly and properly taken in his domain. Can view block analytics. They also manage vlonteers for schools which do not have internet bandwidth, so they can also generate papers for schools, give it to volunteers and volunteers can directly work with them.
- District Admin: They are just above block admins and they handle/supervise block admins. Can view district analytics.
- Admin: They sit just above District admin in hierarchy and are on state/UT level. They have authority over district admins and all schools in specific state/UT falls under their domain. Can view state analytics.

*Volunteers*: They work with block admins for schools having low strength of students or insufficient network bandwidth. They can collect papers from block admin and can take assessments.

*Superadmins*: They sit at top of heirarchy, from the Vicharanashala Lab/IIT Ropar. They handle the core decision which can impact every school and position holders working on this FLN platform. They own cirriculum and create/remove admin accounts as well, also they can work with feedback tickets.

*Schools*: It is the normal school that we see in real life as well, it consists of various classes. If they have good strength of students then it is managed by teachers or we can use volunteers for low strength.

*Classes*: It is a group of students studying having similar kind of knowledge, no-one is too sharp or dull. Each class is assigned to 1 teacher such as class 2 for teacher X and class 3 for teacher Y. Either teacher or block admin can generate papers for classes and with a lock to prevent issues.

*Assessments*: The teacher takes the assessments to evaluate the learning of specific concept for the students. So, they can determine whether students are learning or they are only pretending to listen and cannot understand properly.

*Worksheets*: Helps learn a concept that is weak, it contains numerous resources helpful for each student to read, learn and understand the concept the worksheet is generated for.

*Certifications*: A certificate of some grade represnts that the student has knowledge of those concepts, has learnt, and can work on newer concepts which have these certified ones as prerequisites.

The data flows in a manner that: For new school the teacher generates a generic question paper as per class of students, then after the students complete assessments the auto-evaluation stores whether each student has knowledge of those concepts or not, if they have the knowledge then the certificate is generated and the student progresses, while if they cannot clear that level then those topics are marked as weak topics for that student and a reassessment happens with appropriate lower level. The teacher can also see the data for all the students they have taken assessment for in a school/class. HTML files are used to generate papers using A4 PDF (Puppeteer) and printed.
Then once the grades/certications are given to students then teacher can now generate personalized assessment FLN papers for students with their student id tagged in question paper.


**3) Current State of the Repository — What Has Been Done So Far:**

*Ans:* After looking at everthing this is what I have:

Tech Stack: MERN stack has been used to build this project. This represents MongoDB as database, Express as backend framework, React as frontend and Node.js as backend runtime. The auth is handled using JWT tokens with 7 days expiry and bycrpt which is secure. There is role-based access control and express auth middleware in backend/src for now. Though we will use ai-services file at later stages. The login page does not have a dropdown rather it has server side role determining in place. There is specific @fl.org email id check for login in place, password must have min 8 chars, 1 uppercase, 1 number, 1 special character. The program will be refactored before deployment as we have to use ai-servies directory which is core for automation in terms of paper generating as well as evaluation and grade allocation to them. The system falls back to gemini using deterministic fallbacks when APi key isn't available.
The teacher/block admin generates the question (generic for new class and personalized for existing student's prfiles). Papers get rendered as HTML where templates are in place for now, so if need to change anything we have to work with templates not the MongoDB, which is ideal. Papers then get A4 PDF converted using Puppeteer and printed. Student give the assessment within the assessment window, then teacher/vlounteer scans the answer sheets and system auto-evaluates via python pipeline (classify->compare->evaluate->report). Then the student's FLN level gets updated concept mastery profile updates and weak ones also get associated with their profiles. If they pass certificate is given and they move forward, if fail then diagnosis and worksheets, and this cycle repeats.

Generation locks are also in place to prevent pairwise enforcement so two roles cannot generate the paper for same purpose.

**4) Gaps observed in the code:**
RoleDashboards.tsx is a 3,139 line file holding all 8 role dashboards. So, it is not easy to debug and solve the problems while navigating through such a big codebase. So for better management, understanding and navigation we have to move them to separate directories.

**5) Ideas for the Project**
What? Refactoring and refining the directory structure, so debugging would be easier and since it is a shared analytics used by various dashboards it will cause problems in navigation and debugging.
Why? For easier navigation, debugging, understanding and working of the codebase.
How? I will create a separate component in dashboard and also update dependencies and path wherever required so the app remains intact. The detailed points have been mentioned in My contribution i.e. point 6.

**6) My Contribution:**
The steps that I would follow to correctly tackle this issue.
- Will first create frontend/src/components/dashboards/RegionalAnalyticsView.tsx.
- Then, will cut the component out of RoleDashboards.tsx into the new file, with imports it needs carefully.
- Then, back in RoleDashboards.tsx, will add: export { RegionalAnalyticsView } from './dashboards/RegionalAnalyticsView'; where it used to be.
- Not changing any logic, keeping it as it is will change it and also update dependencies/path wherever needed. 
- This will close the issue as per requirement of the repository.

