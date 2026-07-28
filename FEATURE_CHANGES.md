# Feature Documentation: Curriculum Feedback & Performance Trend Indicator

Detailed overview of the two new analytical features added to the FLN Assessment & Personalization Platform.

---

## 1. Overview of New Features

### Feature A: Curriculum Feedback
- **Goal:** Automatically flag competencies where a large proportion of students perform poorly.
- **Target Audience:** Curriculum Designers, State Administrative Coordinators, Superadmins, and System Admins.
- **Key Functionality:**
  - Aggregates `conceptMastery` data across all student evaluation reports (`EvaluationReport`).
  - Flags competencies where $\ge 40\%$ of assessed students score *"Needs Practice"*.
  - Categorizes severity levels:
    - 🔴 **Critical** ($\ge 60\%$ weak rate)
    - 🟡 **Needs Attention** ($40-59\%$ weak rate)
    - 🔵 **Monitor** ($<40\%$ weak rate)
  - Displays stacked mastery distribution bars (Strong / Satisfactory / Needs Practice).
  - Lists individual affected students for targeted intervention.
  - Provides tailored instructional recommendations per competency (e.g., introducing visual manipulatives, hands-on measuring, array models).

---

### Feature B: Performance Trend Indicator
- **Goal:** Categorize students by their performance trajectory across assessments to help teachers prioritize follow-up actions.
- **Target Audience:** Teachers, Volunteers, School Principals, and Block Administrators.
- **Key Functionality:**
  - Analyzes each student's `levelHistory` timeline chronologically.
  - Categorizes students into four categories:
    - 📈 **Improving** — Level has increased over recent assessments
    - ➡️ **Stable** — Level remains unchanged across assessments
    - 📉 **Declining** — Level has decreased (requires immediate intervention)
    - 🆕 **New / Pending** — Insufficient data points (fewer than 2 assessments)
  - Provides two UI rendering modes:
    - **Compact Mode:** Embedded directly inside the existing *Performance* panel for quick reference.
    - **Full Mode:** Standalone *Trends* dashboard with search bar, quick filters, and sortable columns (Name, Trend, Level, Level Change, Last Assessed Date).

---

## 2. File Changes & Architecture

| File | Type | Description |
|------|------|-------------|
| `frontend/src/components/CurriculumFeedback.tsx` | **New File** | Component for competency analysis, severity classification, and curriculum recommendations. |
| `frontend/src/components/PerformanceTrendIndicator.tsx` | **New File** | Component for analyzing student level history timelines and displaying trend badges. |
| `frontend/src/components/Layout.tsx` | **Modified** | Added sidebar navigation entries for *Curriculum Feedback* (Admin roles) and *Trends* (Teacher roles). |
| `frontend/src/components/PanelViews.tsx` | **Modified** | Added panel routing for `curriculum_feedback` and `trends`, plus embedded compact trend indicators into the *Performance* panel. |
| `frontend/src/index.css` | **Modified** | Added CSS keyframe animations (`pulseGlow`, `scaleIn`) for flagged badges and trend indicators. |

---

## 3. Component Details & Props

### `CurriculumFeedback`
- **Props:**
  - `reports: EvaluationReport[]` — List of evaluation reports to analyze.
  - `students: Student[]` — Student roster for mapping names and IDs.
- **Location in App:** Accessible via sidebar under `📋 Curriculum Feedback` for Superadmin and Admin roles.

### `PerformanceTrendIndicator`
- **Props:**
  - `students: Student[]` — List of student objects containing `levelHistory`.
  - `compact?: boolean` — Set to `true` when embedding inside existing panels.
- **Location in App:** Accessible via sidebar under `📈 Trends` and inside the `Performance` panel for Teachers, Volunteers, Schools, and Block Admins.

---

## 4. Local Verification & Testing

To test and verify these features locally:

1. **Start the Frontend Dev Server:**
   ```bash
   npm run dev:frontend
   ```
2. **Access local server:** Open [http://localhost:5173](http://localhost:5173) in your browser.
3. **Test Admin View:**
   - Log in as `superadmin@fln.org`
   - Select **Curriculum Feedback** from the sidebar
   - Verify severity cards, distribution bars, and recommendations display correctly.
4. **Test Teacher View:**
   - Switch role / log in as `gps-mt-001.t01@fln.org` (Teacher)
   - Navigate to **Performance** panel to view the compact trend indicator.
   - Navigate to **Trends** panel to test searching, sorting, and filtering by trend category.
