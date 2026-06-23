# Contributing to FLN

Thank you for your interest in contributing to the Foundational Literacy and Numeracy (FLN) project. This guide explains how to propose changes through GitHub.

---

## How to Fork

1. Navigate to the FLN repository on GitHub.
2. Click **Fork** in the top-right corner to create a copy under your GitHub account.
3. Clone your fork locally:

```bash
git clone https://github.com/<your-username>/fln.git
cd fln
```

4. Add the upstream repository as a remote so you can sync with the main project:

```bash
git remote add upstream https://github.com/<org-or-owner>/fln.git
```

Replace `<your-username>` and `<org-or-owner>` with the actual GitHub usernames or organisation names.

---

## How to Create a Branch

Always create a new branch for your work. Do not commit directly to `main`.

```bash
git checkout main
git pull upstream main
git checkout -b <type>/<short-description>
```

### Branch naming conventions

Use lowercase, hyphen-separated names with a type prefix:

| Prefix | Use for |
|---|---|
| `docs/` | Documentation updates (README, guides, meeting notes) |
| `level/` | New or updated level content under `FLN Levels Structure/` |
| `worksheet/` | Changes to HTML worksheet generators |
| `research/` | Updates to research documents (`resource.md`, `Metric.md`, `State-Wise-Data.md`) |
| `fix/` | Bug fixes or corrections to existing content |

**Examples:**

```
docs/update-levels-index
level/add-measurement-questions
worksheet/class2-missing-numbers-fix
research/aser-2025-benchmarks
fix/level-10-title-correction
```

---

## What to Contribute

Contributions should align with the project's scope and existing conventions:

### Documentation
- All core documents must be **Markdown (`.md`)** files for cross-platform compatibility and clean version control.
- Project logs, meeting notes, and journals should also use Markdown.
- Keep content consolidated in appropriately scoped files rather than one monolithic document.

### Level content
- Each level focuses on **one concept** with light cognitive load.
- Place files in the correct level directory: `FLN Levels Structure/Level N/`.
- Follow the existing file naming pattern:
  - `Level N_<Concept Name>.md` — level overview
  - `N.0.md` — main level (mastery checkpoint)
  - `N.1.md`, `N.2.md` — sub-levels (easier framing of the same concept)
- Refer to designated source material when creating questions.
- Format regional language questions clearly in English.

### Worksheet generators
- HTML worksheet files are self-contained; test changes by opening the file in a browser.
- Verify Generate, tab switching, Print, and export features after modifications.

### Research documents
- Cite sources and avoid unsupported claims.
- Cross-reference with NIPUN Bharat, NCERT, PARAKH, and ASER where applicable.

---

## Pull Request Process

1. **Sync with upstream** before opening a PR:

```bash
git fetch upstream
git rebase upstream/main
```

2. **Make focused commits** — each commit should represent a logical unit of work with a clear message:

```bash
git add <files>
git commit -m "Add Level 24 measurement introduction"
```

3. **Push your branch** to your fork:

```bash
git push -u origin <type>/<short-description>
```

4. **Open a Pull Request** on GitHub from your fork's branch into the upstream `main` branch.

5. **Fill in the PR description** with:
   - **Summary** — what changed and why
   - **Scope** — which levels, documents, or generators are affected
   - **Testing** — how you verified the changes (e.g., opened HTML file in browser, reviewed Markdown rendering)
   - **Related context** — link to meeting notes, issues, or research documents if applicable

6. **Request review** from a project maintainer and address feedback promptly.

7. **Do not merge your own PR** unless you have maintainer permissions and the review is complete.

### PR quality checklist

- [ ] Changes are limited to the stated scope — no unrelated edits
- [ ] Markdown files render correctly (headings, tables, links)
- [ ] Level files follow the one-concept-per-level principle
- [ ] No invented features or content not grounded in project sources
- [ ] HTML generators tested in a modern browser
- [ ] No secrets, API keys, or credentials included in commits

---

## Content Guidelines

- **Do not use LLMs during the initial idea phase** for new level design — use them only where the team workflow explicitly allows (e.g., comparative analysis, formatting assistance).
- **Comparison concepts** (=, <, >) belong at Level 1 for quantity comparison; numeral comparison appears at Levels 10 and 21.
- **Review assessments** (Levels 11 and 23) should maintain a balanced difficulty mix: approximately 50% easy, 35% moderate, 15% hard.
- **Question formats:** prefer matching questions over separate individual equivalence questions where appropriate.
- Align content with **state board and CBSE textbooks** as the primary reference.

---

## Reporting Issues

If you find incorrect content, broken links, or generator bugs, open a GitHub Issue with:

- A clear title describing the problem
- The file path and section affected
- Steps to reproduce (for HTML generator bugs)
- Expected vs. actual behaviour

---

## Questions

For project-specific questions about scope, priorities, or review assignments, refer to [`minutes_of_meeting.md`](minutes_of_meeting.md) or contact the project maintainers.
