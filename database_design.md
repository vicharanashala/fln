# FLN Platform Database Design

## 1. System Architecture

``` text
                           INDIA
                              │
                 ┌────────────┴────────────┐
                 │ Master Collections      │
                 └────────────┬────────────┘
                              │
                         States Collection
                              │
                              ▼
                      Districts Collection
                              │
                              ▼
                        Blocks Collection
                              │
                              ▼
                        Schools Collection
                              │
               ┌──────────────┴──────────────┐
               │                             │
               ▼                             ▼
        Teachers Collection           Classes Collection
               │                             │
               └──────────────┬──────────────┘
                              │
                              ▼
                      Students Collection
                              │
                              ▼
                 Student Profiles Collection
                              │
               ┌──────────────┼──────────────┐
               │              │              │
               ▼              ▼              ▼
        Assessments     Competencies  Recommendations
               │
               ▼
      Assessment Questions
               │
               ▼
      Generated Question Paper
               │
               ▼
        Offline Assessment
               │
               ▼
      Answer Sheet Upload
               │
               ▼
      OCR & Evaluation
               │
               ▼
      Student Profile Updated
```

------------------------------------------------------------------------

# 2. Master Collections

## States

``` json
{
  "_id": "...",
  "stateCode": "PB",
  "stateName": "Punjab"
}
```

## Districts

``` json
{
  "_id": "...",
  "districtCode": "RPR",
  "districtName": "Rupnagar",
  "stateId": "stateId"
}
```

## Blocks

``` json
{
  "_id": "...",
  "blockCode": "B001",
  "blockName": "Rupnagar",
  "districtId": "districtId"
}
```

------------------------------------------------------------------------

# 3. Operational Collections

## Schools

``` json
{
  "_id": "...",
  "schoolCode": "015",
  "schoolName": "Government Primary School",
  "stateId": "...",
  "districtId": "...",
  "blockId": "...",
  "pincode": "140001"
}
```

## Teachers

``` json
{
  "_id": "...",
  "teacherId": "T0001",
  "firstName": "Sejal",
  "lastName": "Kumari",
  "email": "teacher@example.com",
  "phone": "9876543210",
  "password": "hashedPassword",
  "schoolId": "...",
  "isActive": true,
  "createdBy": "adminId"
}
```

## Classes

``` json
{
  "_id": "...",
  "className": "Class 1",
  "teacherId": "...",
  "schoolId": "..."
}
```

## Students

``` json
{
  "_id": "...",
  "studentId": "PB-RPR-015-0001",
  "name": "Rahul Kumar",
  "age": 6,
  "gender": "Male",
  "classId": "...",
  "teacherId": "...",
  "schoolId": "...",
  "createdAt": "..."
}
```

## Student Profiles

``` json
{
  "_id": "...",
  "studentId": "...",
  "currentLevel": "Level 2",
  "weakTopics": [
    "Addition",
    "Counting"
  ],
  "strongTopics": [
    "Shapes"
  ],
  "recommendedWorksheets": [],
  "lastAssessment": "assessmentId"
}
```

------------------------------------------------------------------------

# 4. Assessment Collections

## Question Bank

-   Question
-   Difficulty
-   Topic
-   Learning Outcome
-   Bloom's Level
-   Correct Answer

## Assessments

``` text
assessmentId
teacherId
classId
testType
generatedAt
```

## Assessment Questions

``` text
assessmentId
questionId
questionOrder
```

## Student Assessments

``` text
studentId
assessmentId
score
level
status
```

------------------------------------------------------------------------

# 5. AI / OCR Collections

## Answer Sheets

-   studentId
-   assessmentId
-   imageUrl

## OCR Results

-   ocrText
-   confidence

## Evaluation Results

-   obtainedMarks
-   competencyAnalysis
-   suggestedLevel

------------------------------------------------------------------------

# 6. Relationships

``` text
State
 │
 ▼
District
 │
 ▼
Block
 │
 ▼
School
 │
 ▼
Teacher
 │
 ▼
Class
 │
 ▼
Student
 │
 ▼
Student Profile
 │
 ▼
Assessment
```

------------------------------------------------------------------------

# 7. Admin Flow

``` text
Super Admin
      │
      ▼
Import States
      │
      ▼
Import Districts
      │
      ▼
Import Blocks
      │
      ▼
Create School
      │
      ▼
Create Teacher
```

------------------------------------------------------------------------

# 8. Teacher Flow

``` text
Teacher Login
      │
      ▼
Select Class
      │
      ▼
Add Student
      │
      ▼
Student ID Generated
      │
      ▼
Generate Baseline Test
      │
      ▼
Generate PDF
      │
      ▼
Offline Assessment
      │
      ▼
Upload Answer Sheet
      │
      ▼
OCR
      │
      ▼
Evaluation
      │
      ▼
Update Student Profile
      │
      ▼
Generate Recommendation
```

------------------------------------------------------------------------

# 9. Student ID Format

    <State Code>-<District Code>-<School Code>-<Sequence>

    Example:

    PB-RPR-015-0001

------------------------------------------------------------------------

# 10. Folder Classification

``` text
Master Collections
------------------
states
districts
blocks

Operational Collections
-----------------------
schools
teachers
classes
students
studentProfiles

Assessment Collections
----------------------
questionBank
assessments
assessmentQuestions
studentAssessments

AI Collections
--------------
answerSheets
ocrResults
evaluationResults

Analytics
----------
competencies
recommendations
reports
```
