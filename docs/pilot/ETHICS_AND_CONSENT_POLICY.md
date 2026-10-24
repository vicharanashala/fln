# Pilot Ethics Clearance & Guardian/School Consent Policy

**Document Status:** Approved Protocol for V0.1 Vertical-Slice Pilot  
**Target Group:** Foundational Literacy & Numeracy (FLN) Students (Classes 2–4 / Ages 5–10)  
**Governing Institution:** IIT Ropar & Partner School Systems  
**Issue Reference:** Closes #452  

---

## 1. Executive Summary & Purpose

The FLN Assessment & Personalized Worksheet Platform evaluates foundational numeracy through printed worksheets, digitizing physical completed papers via photography, and applying automated ICR/OCR and human diagnostic review. 

Because the pilot involves photographing handwritten papers produced by minors in school environments, this policy establishes:
1. **Institutional Ethics Compliance:** Alignment with Indian Council of Medical Research (ICMR) & IIT Ropar guidelines for research involving children.
2. **Guardian & School Consent:** Standardized bilingual consent forms (English & Hindi) for school administrators and parents/guardians.
3. **Data Protection & PII Masking:** Strict anonymization protocols requiring student Aadhaar and personal identifier masking before digital ingestion.
4. **Data Retention & Lifecycle:** Clear limits on raw photo storage, access controls, and deletion workflows.

No worksheet photograph or student response data may be collected in any classroom until signed consent is secured under this policy.

---

## 2. Institutional Ethics Framework (IIT Ropar Guidelines)

In accordance with institutional requirements for research involving minors:
- **Risk Assessment:** Minimal risk. Participation involves normal classroom instructional and assessment activities (completing math worksheets).
- **Voluntary Participation:** Participation is voluntary. A child or parent may refuse consent or withdraw at any time without any impact on regular academic standing, grades, or school benefits.
- **Child Assent:** Verbal assent is obtained from participating children in age-appropriate language prior to administering pilot worksheets.
- **Ethics Review Status:** Protocol filed with the Institutional Ethics Committee (IEC). Data collection is restricted strictly to pedagogical assessment and error-pattern identification.

---

## 3. Parent / Guardian Consent Form (Bilingual)

### English Version

```text
PARENT / GUARDIAN INFORMED CONSENT FORM

Project Title: FLN Assessment & Personalized Worksheet Pilot
Executing Institution: IIT Ropar & Partner Schools

Dear Parent/Guardian,

Your child’s school is participating in an educational research pilot to improve foundational mathematics learning for primary students (Classes 2–4). As part of this program:
1. Your child will complete short, level-appropriate math worksheets during regular class hours.
2. Completed paper worksheets will be photographed by authorized school teachers for educational evaluation and diagnostic feedback.
3. Student names and Aadhaar numbers will NEVER be published or stored with photo images. All uploaded images will be masked to protect child identity.
4. Images will be stored securely and used solely by the research team to evaluate math learning patterns.
5. Participation is voluntary. You may withdraw your consent at any time by informing the school principal.

Consent Declaration:
[ ] I GIVE CONSENT for my child to participate in the FLN pilot assessment and for their completed paper worksheets to be photographed and evaluated under strict privacy conditions.
[ ] I DO NOT GIVE CONSENT for my child to participate in the photography/digital pilot.

Student Name: ____________________________________  Class/Section: ____________
School Name: _____________________________________  Date: ________________________
Parent/Guardian Name: ____________________________  Signature: ___________________
```

### Hindi Translation (हिंदी अनुवाद)

```text
अभिभावक सहमति पत्र (Parent / Guardian Informed Consent Form)

परियोजना का नाम: एफ.एल.एन. मूल्यांकन एवं व्यक्तिगत वर्कशीट पायलट
संस्था: आईआईटी रोपड़ एवं सहभागी विद्यालय

आदरणीय अभिभावक,

आपके बच्चे का विद्यालय प्राथमिक स्तर (कक्षा 2-4) के बच्चों की गणितीय दक्षता में सुधार हेतु एक शैक्षणिक पायलट कार्यक्रम में भाग ले रहा है। इस कार्यक्रम के अंतर्गत:
1. आपका बच्चा नियमित कक्षा समय के दौरान छोटे, स्तर-अनुसार गणित वर्कशीट हल करेगा।
2. हल की गई कागजी उत्तर पुस्तिकाओं/वर्कशीट की तस्वीरें केवल अधिकृत शिक्षकों द्वारा शैक्षणिक मूल्यांकन हेतु ली जाएंगी।
3. बच्चे का नाम या आधार नंबर कभी भी सार्वजनिक नहीं किया जाएगा। डिजिटल प्रणाली में अपलोड करने से पहले पहचान संबंधी जानकारी हटा/ढक (mask) दी जाएगी।
4. तस्वीरें सुरक्षित रखी जाएंगी और उनका उपयोग केवल सीखने के तरीकों को समझने के लिए किया जाएगा।
5. यह भागीदारी पूरी तरह ऐच्छिक है। आप किसी भी समय अपनी सहमति वापस ले सकते हैं।

सहमति घोषणा:
[ ] मैं अपने बच्चे को एफ.एल.एन. मूल्यांकन में भाग लेने तथा उसकी वर्कशीट की तस्वीर लेकर सुरक्षित मूल्यांकन करने की सहमति देता/देती हूँ।
[ ] मैं अपने बच्चे के लिए सहमति नहीं देता/देती हूँ।

विद्यार्थी का नाम: __________________________________  कक्षा/वर्ग: ____________
विद्यालय का नाम: _________________________________  दिनांक: ________________________
अभिभावक का नाम: _________________________________  हस्ताक्षर: ___________________
```

---

## 4. School Authority Permission Agreement

School Principals and Headmasters must sign the institutional authorization before RUN 1 administration:

```text
SCHOOL SYSTEM AUTHORIZATION AGREEMENT

School Name: _____________________________________ UDISE Code: __________________
District: ________________________________________ Block: _______________________

The undersigned Headmaster / Principal hereby authorizes the administration of the FLN Assessment Pilot on school premises subject to the following terms:
1. Administration will occur during standard school hours without disrupting the overall academic schedule.
2. Only teachers with verified platform accounts will take or upload worksheet photographs.
3. The school will maintain signed parent consent forms on file and ensure non-consenting children receive standard offline instruction without photography.
4. The school leadership may inspect the digital records and storage compliance at any time.

Principal Name: __________________________________
Signature & School Stamp: ________________________ Date: ________________________
```

---

## 5. Data Protection, Privacy & Retention Position

### 5.1 Aadhaar & PII Masking
- **Mandatory Anonymization:** Before any paper worksheet photo is uploaded or processed by ICR/OCR, the student's Aadhaar number and full name printed in header areas must be physical or digital masked (blacked out).
- **Pseudonymized ID:** Students are identified in the system solely via internal system IDs (e.g., `STU_C2_001`). Real-name mappings exist only within local school-scoped role authorizations.

### 5.2 Storage & Security Controls
- **Access Control:** Photo assets are stored in encrypted object storage (GCS/local restricted directory) with strict role-based authorization (`canAccessStudent` role check enforcing school-level boundaries).
- **No Commercial Use:** Photos and evaluation records will never be sold, shared with third parties, or used for non-educational commercial purposes.

### 5.3 Data Lifecycle & Deletion Policy
- **Active Retention:** Raw worksheet photos are retained for a maximum of 180 days following the completion of the pilot evaluation cycle to allow human diagnostic audits (#410).
- **Archival & Deletion:** Upon completion of research analysis, raw handwriting image files will be permanently purged from servers. Pseudonymized performance metrics (scores, concept mastery ratings) may be retained for longitudinal academic research.
- **Right to Erasure:** If a parent/school withdraws consent, all raw image files associated with the student will be deleted within 14 calendar days.

---

## 6. Verification & Sign-Off Matrix

| Requirement | Responsible Role | Sign-Off Deliverable | Status |
|---|---|---|---|
| Institutional Ethics Approval | Research Lead (IIT Ropar) | Ethics Approval Letter / Waiver | Documented |
| School Authority Agreement | Principal / Headmaster | Signed Permission Form | Required before RUN 1 |
| Guardian Informed Consent | Class Teacher / Admin | Signed Parental Consent Index | Required before RUN 1 |
| PII Masking Verification | System Admin / Developer | System Anonymization Check | Active in Codebase |

---

*This policy forms part of the V0.1 Stage 0 deployment standards and is enforced across all pilot school operations.*
