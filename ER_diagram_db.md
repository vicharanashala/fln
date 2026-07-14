# FLN Platform Entity Relationship Diagram (ERD)

## Overview

This ERD represents the database design for the FLN (Foundational
Literacy and Numeracy) Assessment Platform.

------------------------------------------------------------------------

## Entity Relationship Diagram

``` text
                                       ┌────────────────────┐
                                       │       ADMIN        │
                                       ├────────────────────┤
                                       │ _id               │
                                       │ name              │
                                       │ email             │
                                       │ password          │
                                       └─────────┬──────────┘
                                                 │ creates
                                                 ▼
┌────────────────────┐                 ┌────────────────────┐
│      STATES        │◄───────────────►│      SCHOOLS       │
├────────────────────┤                 ├────────────────────┤
│ _id               │                 │ _id               │
│ stateCode         │                 │ schoolCode        │
│ stateName         │                 │ schoolName        │
└─────────┬──────────┘                 │ stateId           │
          │                            │ districtId        │
          ▼                            │ blockId           │
┌────────────────────┐                 │ pincode           │
│     DISTRICTS      │                 └─────────┬──────────┘
├────────────────────┤                           │
│ _id               │                           ▼
│ districtCode      │                 ┌────────────────────┐
│ districtName      │                 │      TEACHERS      │
│ stateId           │                 ├────────────────────┤
└─────────┬──────────┘                 │ teacherId         │
          │                            │ name              │
          ▼                            │ email             │
┌────────────────────┐                 │ phone             │
│      BLOCKS        │                 │ password          │
├────────────────────┤                 │ schoolId          │
│ _id               │                 └─────────┬──────────┘
│ blockCode         │                           │
│ blockName         │                           ▼
│ districtId        │                 ┌────────────────────┐
└────────────────────┘                 │      CLASSES       │
                                       ├────────────────────┤
                                       │ className         │
                                       │ teacherId         │
                                       │ schoolId          │
                                       └─────────┬──────────┘
                                                 │
                                                 ▼
                                       ┌────────────────────┐
                                       │      STUDENTS      │
                                       ├────────────────────┤
                                       │ studentId         │
                                       │ name              │
                                       │ age               │
                                       │ gender            │
                                       │ classId           │
                                       │ teacherId         │
                                       │ schoolId          │
                                       └─────────┬──────────┘
                                                 │
                       ┌─────────────────────────┼─────────────────────────┐
                       ▼                         ▼                         ▼
          ┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐
          │ STUDENT PROFILE    │    │   ASSESSMENTS      │    │  QUESTION BANK     │
          ├────────────────────┤    ├────────────────────┤    ├────────────────────┤
          │ currentLevel      │    │ assessmentId       │    │ questionId         │
          │ weakTopics        │    │ teacherId          │    │ topic              │
          │ strengths         │    │ classId            │    │ difficulty         │
          │ progress          │    │ testType           │    │ bloomLevel         │
          └────────────────────┘    └─────────┬──────────┘    │ answer             │
                                              │               └────────────────────┘
                                              ▼
                                   ┌────────────────────────┐
                                   │ STUDENT ASSESSMENTS    │
                                   ├────────────────────────┤
                                   │ studentId             │
                                   │ assessmentId          │
                                   │ score                │
                                   │ level                │
                                   └─────────┬─────────────┘
                                             ▼
                                   ┌────────────────────────┐
                                   │   ANSWER SHEETS        │
                                   ├────────────────────────┤
                                   │ imageUrl             │
                                   │ ocrText              │
                                   │ evaluationStatus     │
                                   └─────────┬─────────────┘
                                             ▼
                                   ┌────────────────────────┐
                                   │ EVALUATION RESULTS     │
                                   ├────────────────────────┤
                                   │ competencyAnalysis    │
                                   │ suggestedLevel        │
                                   │ confidence            │
                                   └─────────┬─────────────┘
                                             ▼
                                   ┌────────────────────────┐
                                   │ RECOMMENDATIONS        │
                                   ├────────────────────────┤
                                   │ worksheetId           │
                                   │ weakTopics            │
                                   │ nextLearningPath      │
                                   └────────────────────────┘
```

------------------------------------------------------------------------

## Relationship Summary

  Parent Entity        Child Entity         Cardinality
  -------------------- -------------------- -------------
  State                District             1 : N
  District             Block                1 : N
  Block                School               1 : N
  School               Teacher              1 : N
  School               Class                1 : N
  Teacher              Class                1 : N
  Class                Student              1 : N
  Student              Student Profile      1 : 1
  Student              Student Assessment   1 : N
  Assessment           Student Assessment   1 : N
  Student Assessment   Answer Sheet         1 : 1
  Student Assessment   Evaluation Result    1 : 1
  Student              Recommendation       1 : N

------------------------------------------------------------------------

## Notes

-   Master collections: States, Districts, Blocks.
-   Operational collections: Schools, Teachers, Classes, Students.
-   Assessment collections: Question Bank, Assessments, Student
    Assessments.
-   AI collections: Answer Sheets, OCR Results, Evaluation Results.
-   Student Profile stores competency level, weak topics, strengths, and
    recommendations separately from basic student information.
