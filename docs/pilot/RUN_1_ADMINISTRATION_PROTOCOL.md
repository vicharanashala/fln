# RUN 1 — Pilot Worksheet Administration & Photography Protocol

**Document Status:** Operational Protocol for RUN 1  
**Target Group:** Selected Class 2 Vertical Slice Pilot (SK13 Concept Chain, 8–12 concepts)  
**Dependencies:** Requires signed consent under `docs/pilot/ETHICS_AND_CONSENT_POLICY.md` (#452)  
**Issue Reference:** Closes #453  

---

## 1. Overview & Objectives

RUN 1 is the physical administration phase of the V0.1 vertical-slice pilot. Its objective is to print, administer, and photograph completed student worksheets under real classroom conditions, generating high-quality digitized response sheets for human diagnostic evaluation (#410).

This document details the end-to-end operational procedure across six key stages:
1. Consent Verification (#452 Pre-check)
2. Worksheet Batch Printing
3. Classroom Administration
4. High-Fidelity Photography
5. PII Masking & Ingestion
6. Handoff to Human Diagnosis (#410)

---

## 2. Pre-Administration Consent Verification (#452 Check)

Before printing or distributing any worksheet in a participating school:

- [ ] **School Authorization Check:** Confirm the Principal/Headmaster has executed the School System Authorization Agreement (`ETHICS_AND_CONSENT_POLICY.md` §4).
- [ ] **Student Consent Audit:** Verify that a signed Parent/Guardian Consent Form (`ETHICS_AND_CONSENT_POLICY.md` §3) is recorded for every student receiving a worksheet.
- [ ] **Non-Consenting Children Protocol:** Students without signed parental consent must be provided standard offline practice sheets. **NO photographs may be taken of non-consenting children or their papers.**

---

## 3. Printing & Paper Formatting Specifications

- **Target Chain:** Selected 8–12 concept SK13 pilot chain (Class 2 numeracy, covering place value, regrouping, multiplication basics).
- **Paper Size:** Standard A4 (210mm x 297mm), 75–80 GSM white paper.
- **Print Settings:** Single-sided or double-sided depending on page count. High-contrast black-and-white printing (minimum 300 DPI printer resolution).
- **Header Elements:**
  - System Worksheet ID (e.g. `WS_C2_BASE_001`) with scannable barcode/QR code anchor.
  - Student ID field (`STU_C2_XXX`).
  - Pre-allocated QR alignment anchors at all 4 corners of the page for ICR/OCR rectification.

---

## 4. Classroom Administration Protocol

### 4.1 Test Environment & Timings
- **Administration Window:** Administered during standard morning instruction hours under regular classroom conditions.
- **Duration:** 45 minutes total (including 5 minutes for instructions and distribution).
- **Pacing:** Students complete items using standard pencil/pen independently.

### 4.2 Teacher Instructions
1. Distribute pre-printed worksheets matching assigned student IDs.
2. Read instructions aloud clearly in local instructional language (Hindi/English).
3. Emphasize that rough work should be done in designated margins or blank spaces on the worksheet itself (allows error-pattern analysis during #410).
4. Collect completed papers immediately upon conclusion of the 45-minute window.

---

## 5. Photography & Image Capture Guidelines

To ensure accurate automated ICR/OCR processing and legibility for human evaluators (#410):

### 5.1 Camera Setup & Environmental Requirements
- **Device:** Smartphone camera with minimum 12 MP resolution and autofocus.
- **Lighting:** Uniform daylight or diffused overhead lighting. Avoid direct harsh sunlight or strong single-direction shadows.
- **Surface:** Flat, dark, non-reflective mat or table surface contrasting with white A4 paper.

### 5.2 Capture Technique
1. Position the smartphone directly parallel (90° top-down perspective) to the flat paper.
2. Ensure all 4 corner alignment markers and header barcodes are fully visible inside the camera frame.
3. Check focus before capturing; verify crisp legibility of handwritten digits.
4. For multi-page worksheets, photograph Page 1 and Page 2 sequentially, maintaining consistent orientation.

---

## 6. PII Masking & Digital Ingestion

Before uploading raw image files to the server repository or shared diagnostic directory:

1. **Aadhaar & Name Masking:** Inspect header region. Ensure student names and Aadhaar numbers are masked (digitally or physically covered) per `ETHICS_AND_CONSENT_POLICY.md` §5.1.
2. **File Naming Convention:** Name image files using internal pseudonymized IDs:
   `RUN1_<SchoolUDISE>_<StudentSystemID>_<WorksheetID>_P<PageNum>.jpg`  
   *Example:* `RUN1_030101001_STU_C2_014_WS_001_P1.jpg`
3. **Upload Location:** Save raw photo sets to the secure staging directory (`backend/data/uploads/run1_photos/` or designated encrypted pilot cloud bucket).

---

## 7. Handoff to Human Diagnosis (#410)

Once photos are uploaded and validated:

1. **Completeness Verification:** Confirm photo count matches student roster count for the pilot class.
2. **Quality Gate:** Flag and re-photograph any blurry, cut-off, or poorly lit submissions.
3. **Handoff Bundle:** Package the anonymized image set alongside answer keys and curriculum concept mapping (`CURRICULUM_MAPPING`).
4. **Notification:** Trigger handoff to the human evaluation team (#410) for wrong-answer error taxonomy classification.

---

*This protocol governs RUN 1 execution and protects data integrity for downstream evaluation.*
