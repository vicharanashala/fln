# Contributor Onboarding: FLN Assessment & Remediation Platform

## 1. What is FLN?

FLN stands for Foundational Literacy and Numeracy. The FLN Assessment Portal supports the assessment and evaluation of students' foundational literacy and numeracy skills.

## 2. What do you understand by FLN as a system?

The FLN platform supports student assessment and evaluation through different workflows.

One part of this workflow involves scanned student assessment submissions. OCR (Optical Character Recognition) extracts student responses from scanned documents. These extracted responses can then be stored and reviewed by teachers when necessary.

## 3. Current State of the Repository – What Has Been Done So Far

The repository includes OCR response extraction, persistence, and teacher-review handling.

The OCR response review implementation includes:

- Storing extracted student responses.
- Recording extracted text, OCR confidence, provider information, page number, and bounding-box information.
- Identifying blank, unclear, unreadable, or low-confidence responses that require teacher review.
- Updating pending responses while preserving responses that have already been reviewed.
- Registering the OCR review test in `backend/package.json`.
- Running the OCR review test through the CI test script.

## 4. Gaps Observed in the Code

During implementation, I identified the following areas that require further testing and validation.

### Gap 1: Missing automated persistence tests

The current OCR test file tests `computeRequiresReview`, but does not directly test response creation, updating pending responses, or preserving reviewed responses.

- File: `backend/src/services/scanExtraction.test.ts`
- File: `backend/src/services/scanExtraction.ts`, lines 73–115.

### Gap 2: Database workflow requires dedicated testing

Extracted-response database methods are implemented, but their create, update, and retrieval behaviour needs dedicated automated testing.

- File: `backend/src/db.ts`, lines 1917–1965.

### Gap 3: OCR-to-evaluation integration requires validation

The evaluation routes support optional scan-submission tracking, but the complete OCR-to-evaluation workflow needs further integration testing.

- File: `backend/src/routes/evaluation.ts`, lines 579–637 and 1001–1012.

These are areas requiring additional validation, not confirmed production failures.

## 5. Ideas for the Project

Possible future improvements include:

- Adding automated tests for OCR response creation and persistence.
- Testing updates to pending responses and preservation of reviewed responses.
- Adding database workflow tests for extracted-response retrieval and updates.
- Adding integration tests covering the complete OCR-to-evaluation workflow.

## 6. Your Contribution

I worked on the OCR response review functionality for scanned student assessment submissions.

My contribution includes:

- Implementing OCR response persistence.
- Storing extracted text, OCR confidence, provider information, page number, and bounding-box information.
- Implementing the `computeRequiresReview` function to identify responses that require teacher review.
- Flagging blank, unclear, unreadable, and low-confidence responses.
- Supporting response updates while preserving responses that have already been reviewed.
- Adding four tests for the review-flagging logic.

The four tests passed locally, covering:

1. Blank responses.
2. Ambiguous or unreadable responses.
3. Low-confidence responses.
4. Readable responses with sufficient confidence.

The test is registered in `backend/package.json` as `test:ocr-response-review` and is included in the CI test execution.