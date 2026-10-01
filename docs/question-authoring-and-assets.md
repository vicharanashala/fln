# Question authoring, and where the pictures actually live

## What a Superadmin authors

A Superadmin does not write a question. They write an **intent**: what the child
should do, what they see, and how they answer. The generator turns that into the
actual wording, the numbers, and the answer.

```
intent   "The child counts the objects shown and writes one numeral in the
          answer space. Use a different count each time."
family    counting
themes    fruits, animals, vehicles
range     0-20
answer    single-number
```

One intent covers every theme. Without the split, "count the apples" would have
to be re-authored for vegetables, animals and vehicles.

**An answer cannot be typed into the form.** The API rejects a non-empty
`answerSpec` rather than dropping it silently, because an author who types an
answer believes it will be used.

`stem` and `answerSpec` still exist on the record. They are legacy columns kept
read-only so rows authored before this model are not lost. New rows leave them
empty and `paramMode` says which model a row was authored under, so nothing has
to guess by sniffing for empty strings.

## Where pictures are stored

**No image file is stored in MongoDB.** There is no GridFS, no binary, and no
base64 `data:` URI anywhere in the database.

Three separate things exist today, and it is worth knowing which is which:

| What | Where | Size |
|---|---|---|
| Question-bank drawings | `questionBank.svgHtml`, SVG markup as a text string | 1,202 rows, ~1.3 MB |
| Worksheet pages | `levelHtmlTemplates.htmlContent`, whole HTML pages as strings, each with ~48 inline `<svg>` tags | 38 rows, ~1.4 MB |
| **Authoring themes (new)** | **files** under `frontend/public/assets/svg/questions/`, listed in `manifest.json` | 11 themes, 2 variants each |

The new themes are the only one of the three that keeps artwork **out** of the
database. The database stores **ids** and nothing else: `svgThemeIds` on the
template, and `svgAsset` on a generated question — the one theme id the
renderer picked from `svgThemeIds` for that draw.

That was deliberate. SVG markup already sits in Mongo in two places; a third
copy would mean the same drawing could disagree with itself depending on which
table you read. Ids are the contract, so a theme can be redrawn or gain variants
without a single stored row changing.

`pickVariant()` chooses a variant from a seed rather than at random, so
regenerating a child's paper produces the same artwork. A different picture on a
reprint would confuse both the child and the scanner.

Any SVG entering the catalogue is checked by `validateSvgMarkup()`: it must be a
real SVG with a `viewBox`, and must not contain a script, an event-handler
attribute, an external URL, or a `foreignObject`. An SVG is executable markup, so
anything unsafe is refused on the way in rather than filtered at render time.

## Options are data, not constants

Number ranges, operations and themes live in the `questionOptions` collection. A
Superadmin adds "0 to 500" through the interface and it appears in the form, in
the API validation and in the catalogue at once, because all three read the same
rows.

Two rules stop that becoming a way to break generation:

- A new option is created `not-ready` and stays out of the generation catalogue
  until something can actually produce a question with it. A label in a database
  is not an implementation.
- Options are deactivated, never deleted, because templates reference their keys.
  Keys and types cannot be edited for the same reason.

`0-100` and `0-1000` remain valid but are reported as deprecated. Persisted data
is never silently rewritten.

## How an intent becomes a question

`levelGenerator.ts` asks `questionTemplates` for the level's concept before it
asks anything else (`backend/src/services/questionTemplateRenderer.ts`).

- **Eligibility.** Only `approved` rows are considered — `status` absent counts
  as approved, because every row written before that field existed is live
  Superadmin content. `assessmentMode: 'observed'` rows are never eligible:
  NCF-FS rules those outcomes out of written tests, so they belong on the
  teacher's sheet, not the child's.
- **`paramMode`, respected both ways.** A legacy `stem` + `answerSpec` pair is
  printed verbatim and never re-authored. A `generationIntent` is rendered by
  its `questionFamily` (all ten families have a renderer). A row with neither
  is skipped with a warning rather than guessed at, so neither model silently
  overrides the other.
- **Deterministic, no LLM.** Numbers and the answer come from one seeded draw,
  so the printed sheet and the answer key stored beside it can never disagree,
  and a reprint produces the same paper. A family renders the *shape* of the
  intent — count the set, solve the sum, complete the pattern — not every
  sentence of it; only `mcq-4` and `true-false` are specialised beyond the
  family's default answer shape, so `fill-blanks`, `matching` and `trace` keep
  that default.
- **Fallback.** A concept with no eligible templates falls back to the legacy
  concept/level generators, because a level nobody has authored for still has
  to produce a paper.

## What is not built yet

No Gemini call turns an intent into a question — deliberately, for the reasons
above. The approval *workflow* (#451) does not exist either: `status` is a
field the API accepts and the generator honours, but nothing proposes,
approves or rejects a row yet, so every row is `approved` until someone sets
`status` through the API.
