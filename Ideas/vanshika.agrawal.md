1. What is FLN?

FLN stands for Foundational Literacy and Numeracy. It is mainly related to the basic skills that children need in their early education, like reading, writing and basic maths.

From what I understood after going through the project, FLN helps teachers and schools understand the actual learning level of students. Sometimes a student may move to the next class but still have gaps in basic concepts. If those concepts are not clear, it can create problems for them later also.

The project helps in assessing students and understanding their current learning level. Instead of only looking at marks, the system focuses more on where the student actually stands in their learning.

I think the main purpose of FLN is to help teachers identify students who need more support and understand where they are facing difficulties. This can help teachers take action earlier instead of finding out about the learning gap much later.

2. What do you understand by FLN (as a system)?

After exploring the project, I understood that FLN is not just a place where student details are stored. Different parts of the system are connected with each other.

There are different types of users in the system:

Students
Teachers
Administrators
Superadmins

Teachers mainly work with students and classes. They can manage students, work with assessments and diagnostics, and generate worksheets.

Administrators and superadmins have access to more management-related features and can work with information at a larger level.

Some of the main things in the system are:

Schools
Classes and sections
Students
Teachers
Assessments
Diagnostics
Worksheets
Student levels
Level history
Certifications

From what I understood, the basic flow is something like this:

A student belongs to a school and a class. The teacher manages the students in that class. Students can go through assessments or diagnostic tests to understand their current learning level.

After the assessment, the system stores information related to the student's level and progress. This information can then be used to track how the student is doing.

Teachers can also work with worksheets and assessment papers. So, the system connects student information, assessments, learning levels and progress in one place.

While going through the Teacher Dashboard, I noticed that there is already a lot of student-related data available. However, some important information is not directly shown in an easy way to the teacher. This is also related to the issue I am currently working on.

3. Current State of the Repository — What Has Been Done So Far

After going through the repository and checking some of the important files, I found that a good amount of the project is already implemented.

The project has separate frontend and backend parts.

The main technologies used in the project are:

Frontend: React and TypeScript
Backend: Node.js and Express
Database: MongoDB

The repository also contains other folders related to AI services, database-related work, documentation, research and ideas.

The project already has features for authentication and different types of users.

There are also different dashboards based on the role of the user.

I mainly explored the teacher side because the issue I am working on is related to the Teacher Dashboard.

In the file:

frontend/src/components/RoleDashboards.tsx

there is a component called TeacherDashboard.

This component handles many teacher-related features. From what I saw, it includes things like:

Loading classes
Loading students
Viewing students class-wise
Adding students
Diagnostic-related work
Worksheet generation
Paper generation
Class filtering
Other teacher dashboard features

The project also has different FLN levels which are used to understand and track student progress.

I also checked:

frontend/src/components/PanelViews.tsx

There is a performance-related section in this file where some student information is already calculated.

For example, it includes things like:

Total students
Average level
Certified students
Students pending diagnostic assessment

The project also has functionality related to assessments, diagnostics and worksheet generation.

Overall, I feel that a lot of the main functionality is already present in the repository. The project already stores and processes a lot of useful student data. One thing I noticed is that some of this information can be shown in a better and quicker way, especially for teachers who need to understand the overall condition of their class.

4. Gaps Observed in the Code
Gap 1: There is no quick class summary on the Teacher Dashboard

Where:
frontend/src/components/RoleDashboards.tsx
TeacherDashboard component

While checking the Teacher Dashboard, I noticed that teachers can see classes and students, but there is no quick summary showing how the class is doing overall.

The teacher can see the student list, but if they want to know something like how many students have been assessed or how many are still pending, they have to check the students individually.

There is currently no simple summary showing:

Total students
Assessed students
Pending students
Students who are at or above their target level
Students who may need more attention

Why it matters:

I think a dashboard should show important information directly. Even if the data already exists, it is not very useful if the teacher has to go through students one by one to understand the overall situation of the class.

This is also the main problem mentioned in Issue #172 – Add Class Summary Bar to Dashboard, which I am currently working on.

Gap 2: Some useful statistics already exist, but they are in a different section

Where:
frontend/src/components/PanelViews.tsx
Performance section

While checking this file, I found that some student statistics are already being calculated in the performance section.

For example, the section contains information such as:

Total students
Average level
Certified students
Students pending diagnostic assessment

However, this information is not directly shown on the main Teacher Dashboard.

Why it matters:

The student data is already available in the system, so some of the important information can be shown directly where the teacher is managing the class.

Also, if the same calculations are written again in multiple places, it can create duplicate code.

So, while working on the class summary bar, I am checking the existing logic first to understand what can be reused.

Gap 3: The current performance metrics are not exactly the same as the metrics required for Issue #172

Where:
frontend/src/components/PanelViews.tsx
Performance-related calculations

The performance section already calculates some student information, but the metrics required for Issue #172 are slightly different.

For example, the issue asks for information such as:

Students who are at or above their target level
Students who have regressed or may need attention

The existing performance section has information such as certified students and students pending diagnostics.

So, I cannot directly copy the existing logic without checking what each value actually represents.

Why it matters:

For example, a student being certified and a student being at or above their target level may not always mean the same thing.

Before implementing the summary, it is important to check the available student fields properly and use the correct conditions for each metric.

Gap 4: The TeacherDashboard component is handling many different things

Where:
frontend/src/components/RoleDashboards.tsx
TeacherDashboard component

While reading the file, I noticed that the TeacherDashboard component is quite large and handles many different responsibilities.

Some of the things it handles include:

Fetching classes
Fetching students
Adding students
Diagnostic-related work
Worksheet generation
Class filtering
Paper generation
Downloading files
Showing different sections of the dashboard

Why it matters:

Because many different things are handled inside one component, it can become difficult to understand where a particular piece of code is written.

It can also become harder to make changes in the future.

While working on the Class Summary Bar, I think it is better to keep that part as a small separate component instead of adding a large amount of new code directly inside the existing dashboard UI.

Gap 5: Empty student data should be handled properly

Where:
frontend/src/components/PanelViews.tsx
Performance-related calculations

Some calculations depend on the number of students.

If a class has no students, calculations such as averages or percentages need to be handled properly.

Why it matters:

A newly created class may not have any students yet.

In that case, the dashboard should not show invalid values or cause errors. It should show something simple like 0 or an appropriate empty state.

This is also something I will keep in mind while working on the Class Summary Bar.

5. Ideas for the Project
Split the Teacher Dashboard into smaller components

What:

While going through the TeacherDashboard, I noticed that it handles many different things in one component.

In the future, I think different parts of the dashboard can be separated into smaller components.

For example:

Class Summary Bar
Class Tabs
Student List
Diagnostic Section
Worksheet Section

Why:

Right now, the component is quite large. Because of this, it can take time to understand where a particular feature or logic is written.

If different sections are separated, the code can become easier to read and maintain.

It will also make it easier to work on one feature without affecting unrelated parts of the dashboard.

How:

The main TeacherDashboard can still handle the main data and state.

Different UI sections can gradually be moved into smaller components.

For example, the Class Summary Bar that I am currently working on can be kept as its own component inside the same file.

Later, other sections can also be separated if needed.

This does not have to be done all at once. It can be done gradually while keeping the existing functionality working.

6. Your Contribution

For my contribution, I am working on Issue #172 – Add Class Summary Bar to Dashboard.

While checking the Teacher Dashboard, I noticed that although the student data is available, there is no quick way for a teacher to understand the overall status of a class.

The dashboard currently shows the student list, but there is no summary showing important information about the whole class.

My contribution is to work on adding a Class Summary Bar to the Teacher Dashboard.

The summary bar will be placed above the class tabs and will use the student data that is already loaded by the dashboard.

The main information I am planning to show is:

Total students
Assessed students
Pending students
Students who are at or above their target level
Students who may need attention based on their progress

Before implementing it, I checked:

frontend/src/components/PanelViews.tsx

because some student-related calculations are already present there.

I am checking what logic can be reused instead of unnecessarily writing the same calculations again.

The main changes for my contribution will be related to:

frontend/src/components/RoleDashboards.tsx

inside the TeacherDashboard.

My plan is:

Get the students for the currently selected class.
Calculate the required summary values from the available student data.
Show these values in a small summary bar above the class tabs.
Make sure the summary changes when the teacher switches to another class.
Handle cases where a class has no students.
Check that existing Teacher Dashboard features are not affected.

I am also preparing the design and implementation plan for this feature as part of my onboarding contribution.

The main purpose of this feature is to make the existing dashboard easier for teachers to use.

Instead of only seeing a list of students, the teacher should be able to quickly understand things like:

How many students are there in the class?
How many have been assessed?
How many are still pending?
How many students are meeting their target?
How many students may need more attention?

I think this is a useful improvement because the required student data is already available in the system. The feature mainly focuses on presenting that information in a more useful and easier way for the teacher.