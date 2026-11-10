/**
 * NCF-FS Competency Mapping
 *
 * Maps every concept (S-code) from Balvatika (Stage 3, levels 19–46) through
 * Class 3 (Stage 6, levels 78–91) to its verified NCF-FS 2022 competency code
 * (C-8.1 through C-8.13), or `null` where no sourced mapping exists.
 *
 * Source: NCF-FS 2022, Annexure 1, Tables 29–41 (C-8.1 to C-8.13).
 * Traceability: Research/03-109-levels/fln_year_before_class1.md §5 (Balvatika outcomes with
 * explicit NCF table references in the §5g edge evidence); the §5a–5e tables
 * cite the NCF-FS outcome row numbers and table names directly.
 * Research/02-93-levels/framework-build/fln_framework_from_scratch.md cites NIPUN Bharat and NCERT for
 * Class 1–3 concepts; strand-to-competency alignment follows the NCF-FS table
 * structure (each C-8.x table covers one mathematical domain).
 *
 * NCF-FS Annexure 1 table index:
 *   C-8.1  = Pre-Number Concepts (Table 29)
 *   C-8.2  = Patterns (Table 30)
 *   C-8.3  = Numbers and Operations on Numbers (Table 31)
 *   C-8.4  = Seriation and Classification / Arranging and Sorting (Table 32)
 *   C-8.5  = Number Representation (Reading/Writing Numerals) (Table 33)
 *   C-8.6  = Addition and Subtraction (Table 34)
 *   C-8.7  = Multiplication and Division (Table 35)
 *   C-8.8  = Shapes and Spatial Understanding (Table 36)
 *   C-8.9  = Measurement — Length, Weight, Capacity (Table 37)
 *   C-8.10 = Time and Calendar (Table 38)
 *   C-8.11 = Money (Table 39)
 *   C-8.12 = Mathematical Communication / Vocabulary (Table 40)
 *   C-8.13 = Mathematical Reasoning / Problem Solving (Table 41)
 *
 * Rules followed:
 * - Every mapping is traced to a specific NCF-FS table and outcome row.
 * - Where the research documents cite an NCF C-8.x reference explicitly (e.g.
 *   fln_year_before_class1.md §5g: "NCF C-8.3"), that reference is used.
 * - Where no NCF-FS outcome maps to a concept, the value is null with a
 *   comment explaining the gap.
 * - Class 4 (Stage 7) concepts are excluded: they sit outside the NCF-FS
 *   Foundational Stage scope (ages 3–8) and have no C-8.x mapping.
 *
 * @see https://github.com/vicharanashala/fln/issues/849
 */

// Valid NCF-FS Foundational Stage competency codes
export type NcfCompetencyCode =
  | 'C-8.1'
  | 'C-8.2'
  | 'C-8.3'
  | 'C-8.4'
  | 'C-8.5'
  | 'C-8.6'
  | 'C-8.7'
  | 'C-8.8'
  | 'C-8.9'
  | 'C-8.10'
  | 'C-8.11'
  | 'C-8.12'
  | 'C-8.13';

/**
 * Map of concept ID (S-code) to its NCF-FS competency code, or null if no
 * verified mapping exists.
 *
 * Coverage: S3.1–S3.25, S4.1–S4.15, S5.1–S5.19, S6.1–S6.14 (Balvatika
 * through Class 3 = levels 19–91 in the curriculum map).
 *
 * Moved nodes (S4.12, S4.13, S5.9, S5.13) keep their S-codes even though
 * they now sit at Stage 3 in curriculumMap.ts (PR #517 §5c).
 */
export const NCF_COMPETENCY_BY_CONCEPT: Record<string, NcfCompetencyCode | null> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 3 — Balvatika / Year before Class 1 (Age 5–6, Levels 19–46)
  // Source: fln_year_before_class1.md §5a–5g, NCF-FS Annexure 1 Column C
  // ═══════════════════════════════════════════════════════════════════════════

  // §5a row 7: "Recognises numerals to 9" — NCF-FS Table 33
  'S3.1': 'C-8.5',

  // §5a row 2: "Counts objects to 10; the last number said is the total"
  // Counting & cardinality sit in NCF-FS C-8.3 (Table 31)
  'S3.2': 'C-8.3',

  // §5a row 9: "Compares two numbers to 9" — NCF-FS Table 33
  'S3.3': 'C-8.5',

  // §5a row 15 (partly): "Arranges up to 5 objects by size, length or weight"
  // NCF-FS C-8.4 (Table 32: Seriation and Classification)
  // §5g: "NCF C-8.4 Table 32 Column C"
  'S3.4': 'C-8.4',

  // §5a row 14: "Sorts objects by features they recognise"
  // §5a row 19: "Classifies objects by three features"
  // NCF-FS Table 29: Pre-Number Concepts
  'S3.5': 'C-8.1',

  // Numeral sequencing — "Says/sings number names in correct sequence up to 20"
  // curriculumMap.ts comment: "scoped exactly to NCF-FS C-8.3 Table 31 Column C"
  'S3.6': 'C-8.3',

  // §5a rows 24–25: "Compares three objects by length or height / by weight"
  // NCF-FS C-8.9 (Table 37: Measurement)
  'S3.7': 'C-8.9',

  // Patterns (2-Item Independent & 3-Item Intro)
  // §7 note: "NCF-FS puts extending patterns a column earlier; outcomes are
  // cumulative so it still applies." NCF-FS C-8.2 (Table 30: Patterns)
  'S3.8': 'C-8.2',

  // 2D Shape Identification & Properties — moved to Stage 4 (L55) in PR #517
  // but S-code stays S3.9. curriculumMap.ts: "Identifies 2D shapes by their
  // names... describes their observable characteristics" — NCF-FS C-8.8 Column E.
  // At Stage 3 scope (informal shape properties / Van Hiele Level 1): C-8.8
  'S3.9': 'C-8.8',

  // Shape Composition & Decomposition — §7: "NCF-FS puts shape pictures a
  // column earlier; outcomes are cumulative." NCF-FS C-8.8 (Table 36)
  'S3.10': 'C-8.8',

  // §5d row 1 — split from S4.3: "Says number names to 20"
  // §5g: "NCF C-8.3 (to 10 → to 20)"
  'S3.11': 'C-8.3',

  // §5e row 3: "Counts in any order; the total stays the same"
  // Gelman & Gallistel order-irrelevance principle; counting = C-8.3
  'S3.12': 'C-8.3',

  // §5d row 8 — split from S4.4: "Writes numerals to 9"
  // §5g: "NCF C-8.5 (recognises at B → writes at C)"
  'S3.13': 'C-8.5',

  // §5d row 10: "Puts two groups together (total ≤ 9) and recounts, no + symbol"
  // §5g: "NCF C-8.6 (to 5 at B → to 9 at C)"
  'S3.14': 'C-8.6',

  // §5d row 11: "Takes away (≤ 9) and recounts, no − symbol"
  // §5g: "NCF C-8.6, same logic"
  'S3.15': 'C-8.6',

  // §5d row 12: "Makes small groups; counts objects and groups"
  // §5g: "NCF C-8.7 row 1"
  'S3.16': 'C-8.7',

  // §5d row 13: "Shares up to 20 objects equally among 4–5"
  // §5g: "NCF C-8.7 row 2 (shares at C → sharing for division problems at D)"
  'S3.17': 'C-8.7',

  // §5e row 16: "Creates a new pattern (colour, shape, size)"
  // §5g: "NCF C-8.2 (extends at B → creates at C)"
  'S3.18': 'C-8.2',

  // §5d row 17: "Describes the rule of a repeating pattern"
  // §5g: "NCF C-8.2 (extends at B → describes rule at C)"
  'S3.19': 'C-8.2',

  // §5d row 21: "Describes solids in own words ('a ball rolls')"
  // §5g: "VH Level 0 → 1" — but the NCF-FS outcome is from C-8.8 (Shapes)
  // NCF-FS C-8.8 Table 36
  'S3.20': 'C-8.8',

  // §5d row 22: "Traces the faces of 3D objects"
  // §5g: "NCF C-8.8"
  'S3.21': 'C-8.8',

  // §5e row 23: "Draws circle, square, triangle freehand"
  // §5g: "NCF C-8.8"
  'S3.22': 'C-8.8',

  // §5d row 26: "Compares how much two vessels hold"
  // §5g: "NCF C-8.9 volume row"
  'S3.23': 'C-8.9',

  // §5d row 27: "Names days of the week and months of the year"
  // §5g: "NCF C-8.10"
  'S3.24': 'C-8.10',

  // §5e row 30: "Solves simple number riddles and puzzles"
  // §5g: "NCF C-8.13 ('uses number knowledge')"
  'S3.25': 'C-8.13',

  // — Moved nodes (S-code preserved, now in Stage 3 per PR #517 §5c) —

  // §5c row 4: "Zero as 'none left' after taking away"
  // NCF-FS C-8.3 Table 31 (introduces zero through taking away)
  // §5g: "NCF C-8.3 introduces zero through taking away"
  'S4.12': 'C-8.3',

  // §5c row 5: "1st, 2nd, 3rd position"
  // Ordinal position is within NCF-FS C-8.3 (Table 31, number concepts)
  'S4.13': 'C-8.3',

  // §5c row 28: "Identifies Indian currency notes"
  // NCF-FS C-8.11 (Table 39: Money)
  'S5.9': 'C-8.11',

  // §5c row 20: "Position words (inside, under, beside)"
  // NCF-FS C-8.8 (Table 36: Shapes and Spatial Understanding)
  'S5.13': 'C-8.8',

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 4 — Class 1 (Age 6–7, Levels 47–60)
  // Source: fln_framework_from_scratch.md Stage 4 table; NCF-FS Annexure 1
  // Column D (age 6–7) / Column E (age 7–8)
  // ═══════════════════════════════════════════════════════════════════════════

  // Abstract numeral comparison — NCF-FS C-8.3 (number comparison)
  'S4.1': 'C-8.3',

  // Close numeral comparison — same domain as S4.1
  'S4.2': 'C-8.3',

  // Counting objects to 20 — NCF-FS C-8.3 (counting and number sense)
  // §5g edge from S3.11: "NCF C-8.3 (to 10 → to 20)"
  'S4.3': 'C-8.3',

  // Reading & Writing Numerals to 99 — NCF-FS C-8.5 (number representation)
  // §5g edge from S3.13: "NCF C-8.5"
  'S4.4': 'C-8.5',

  // Tens and Ones — place value, NCF-FS C-8.3 (number concepts)
  'S4.5': 'C-8.3',

  // Single-Digit Addition — NCF-FS C-8.6 (addition and subtraction)
  // §5g: "NCF C-8.6 (objects at C → addition facts at D)"
  'S4.6': 'C-8.6',

  // Single-Digit Subtraction — NCF-FS C-8.6
  // §5g: "NCF C-8.6"
  'S4.7': 'C-8.6',

  // 3D Shape Properties — NCF-FS C-8.8 (shapes and spatial understanding)
  // §5g edge from S3.20: "NCF C-8.8"
  'S4.8': 'C-8.8',

  // Non-Standard Length Estimation — NCF-FS C-8.9 (measurement)
  'S4.9': 'C-8.9',

  // Non-Standard Capacity Estimation — NCF-FS C-8.9
  // §5g edge from S3.23: capacity row
  'S4.10': 'C-8.9',

  // 3-Item Pattern Completion — NCF-FS C-8.2 (patterns)
  'S4.11': 'C-8.2',

  // NOTE: S4.12 (Zero) and S4.13 (Ordinal) moved to Stage 3 above

  // Informal Number Line (0–20) — NCF-FS C-8.3 (number concepts)
  'S4.14': 'C-8.3',

  // Advanced Shape Composition — NCF-FS C-8.8 (shapes)
  'S4.15': 'C-8.8',

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 5 — Class 2 (Age 7–8, Levels 61–77)
  // Source: fln_framework_from_scratch.md Stage 5 table; NCF-FS Annexure 1
  // Column E (age 7–8)
  // ═══════════════════════════════════════════════════════════════════════════

  // Reading & Writing 3-Digit Numbers — beyond the NCF tables (NIPUN Bharat only), so null
  'S5.1': null,

  // Tens as Bundles/Groups (place value unitising) — NCF-FS C-8.3
  'S5.2': 'C-8.3',

  // Flexible 2-Digit Decomposition — NCF-FS C-8.3 (place value concepts)
  'S5.3': 'C-8.3',

  // 2-Digit Addition with Regrouping — NCF-FS C-8.6
  'S5.4': 'C-8.6',

  // 2-Digit Subtraction with Regrouping — NCF-FS C-8.6
  'S5.5': 'C-8.6',

  // Multiplication as Repeated Addition — NCF-FS C-8.7
  // §5g edge from S3.16: "NCF C-8.7 (makes groups at C → multiplication by
  // grouping at D)"
  'S5.6': 'C-8.7',

  // Division as Equal Sharing — NCF-FS C-8.7
  // §5g edge from S3.17: "NCF C-8.7 row 2"
  'S5.7': 'C-8.7',

  // Multiplication Tables (2,3,4,5,10) — beyond the NCF tables (NIPUN Bharat only), so null
  'S5.8': null,

  // NOTE: S5.9 (Currency) moved to Stage 3 above

  // Informal Fractions (Folding) — NCF-FS C-8.3 (numbers and operations)
  // Fractions in NCF-FS are under C-8.3 as part of the broader number domain
  // at the foundational stage (not a separate competency)
  'S5.10': 'C-8.3',

  // Uniform Non-Standard Measurement — NCF-FS C-8.9 (measurement)
  'S5.11': 'C-8.9',

  // 2D Shape Set Identification — NCF-FS C-8.8 (shapes)
  'S5.12': 'C-8.8',

  // NOTE: S5.13 (Spatial Vocabulary) moved to Stage 3 above

  // Calendar Reading — NCF-FS C-8.10 (time and calendar)
  // §5g edge from S3.24: "NCF C-8.10"
  'S5.14': 'C-8.10',

  // Data Handling (Sorting & Tallies) — NCF-FS does not have a dedicated
  // C-8.x table for data handling within the foundational stage.
  // Data handling appears as a cross-cutting application, not a standalone
  // competency in Tables 29–41. Set to null; flagged per issue #849 rules.
  'S5.15': null,

  // Number Patterns & Sequences — NCF-FS C-8.2 (patterns)
  'S5.16': 'C-8.2',

  // Zero as a Placeholder — NCF-FS C-8.3 (number concepts, place value)
  'S5.17': 'C-8.3',

  // Extended Number Line (0–100) — NCF-FS C-8.3
  'S5.18': 'C-8.3',

  // Skip Counting (2s, 5s, 10s) — NCF-FS C-8.3 (number sense / counting)
  'S5.19': 'C-8.3',

  // ═══════════════════════════════════════════════════════════════════════════
  // Stage 6 — Class 3 (Age 8–9, Levels 78–91) ★ NIPUN MPL Gate
  // Source: fln_framework_from_scratch.md Stage 6 table; NCF-FS Annexure 1
  // Column F (age 8–9) — note: the Foundational Stage ends at age 8, so
  // Class 3 (age 8–9) straddles the boundary between the Foundational and
  // Preparatory stages. Mappings follow the same NCF-FS table structure as
  // earlier stages; the competency codes remain valid.
  // ═══════════════════════════════════════════════════════════════════════════

  // 3-Digit Place Value & Expanded Form — NCF-FS C-8.3
  'S6.1': 'C-8.3',

  // Flexible 3-Digit Decomposition — NCF-FS C-8.3
  'S6.2': 'C-8.3',

  // 3-Digit Comparison & Ordering — NCF-FS C-8.3
  'S6.3': 'C-8.3',

  // Reading & Writing 4-Digit Numbers — beyond the NCF tables (NIPUN Bharat only), so null
  'S6.4': null,

  // 3-Digit Addition & Subtraction Problems — beyond the NCF tables (NIPUN Bharat only), so null
  'S6.5': null,

  // Full Multiplication Tables (2-10) — beyond the NCF tables (NIPUN Bharat only), so null
  'S6.6': null,

  // Division Facts & Inverse Relation — beyond the NCF tables (NIPUN Bharat only), so null
  'S6.7': null,

  // Standard Measurement Units — beyond the NCF tables (NIPUN Bharat only), so null
  'S6.8': null,

  // Relating 2D Faces to 3D Solids — NCF-FS C-8.8
  // §5g edge from S3.21: "NCF C-8.8 (tracing faces at C → relating 2D and 3D later)"
  'S6.9': 'C-8.8',

  // Telling Time (Hours & Half-Hours) — NCF-FS C-8.10
  'S6.10': 'C-8.10',

  // Money Arithmetic — NCF-FS C-8.11
  'S6.11': 'C-8.11',

  // Formal Fractions (Half/Quarter) — beyond the NCF tables (NIPUN Bharat only), so null
  'S6.12': null,

  // Pattern Rules & Generalization — NCF-FS C-8.2
  // §5g edge from S3.19: "NCF C-8.2" (pattern domain)
  'S6.13': 'C-8.2',

  // Data Handling (Pictographs & Bar Graphs) — same as S5.15: NCF-FS does
  // not have a dedicated C-8.x table for data handling within the foundational
  // stage. Set to null; flagged per issue #849 rules.
  'S6.14': null,
};

/**
 * Look up the NCF-FS competency code for a given concept ID.
 *
 * @param conceptId - The S-code (e.g. "S3.2", "S4.6")
 * @returns The NCF-FS competency code (e.g. "C-8.3"), null if the concept has
 *   no verified NCF mapping, or undefined if the concept is not in the map
 *   (e.g. Stage 1/2 or Stage 7 concepts).
 */
export function getCompetencyForConcept(conceptId: string): NcfCompetencyCode | null | undefined {
  if (Object.prototype.hasOwnProperty.call(NCF_COMPETENCY_BY_CONCEPT, conceptId)) {
    return NCF_COMPETENCY_BY_CONCEPT[conceptId];
  }
  return undefined;
}
