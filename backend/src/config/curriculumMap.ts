export interface LevelConceptConfig {
  levelNumber: number;
  levelTitle: string;
  conceptId: string;
  stage: number;
  ageGroup: string;
  strand: string;
}

/**
 * Master Registry mapping Curriculum Level Numbers <-> Concept IDs.
 * Re-ordering levels in the curriculum requires ONLY changing the levelNumber assignment here.
 *
 * Stage 3 ("the year before Class 1" / Balvatika) was finalised against NCF-FS 2022
 * (Annexure 1, Tables 29-41) in PR #517 — see Research/fln_year_before_class1.md for
 * the full decision record and Research/fln_level_networks.md Part 2b for the sourced
 * prerequisite edges. That work added 15 nodes to this stage (11 split off later-stage
 * nodes, 4 new), moved 4 nodes in from later stages (S-code kept, stage label only),
 * and widened 2 earlier-stage definitions — shifting every level number below from what
 * shipped before 2026-09-18. Per the PR's own §9, no attempt is made here to keep level
 * numbers stable; conceptId is the durable identity.
 */
export const CURRICULUM_MAPPING: Record<number, LevelConceptConfig> = {
  // --- Stage 1: Preschool 1 (Age 3-4) ---
  1: { levelNumber: 1,  levelTitle: "One-to-One Correspondence",              conceptId: "S1.1", stage: 1, ageGroup: "3-4", strand: "Pre-Number Foundations" },
  2: { levelNumber: 2,  levelTitle: "Classification (Single Property)",         conceptId: "S1.2", stage: 1, ageGroup: "3-4", strand: "Pre-Number Foundations" },
  3: { levelNumber: 3,  levelTitle: "Perceptual Same/Different",                conceptId: "S1.3", stage: 1, ageGroup: "3-4", strand: "Pre-Number Foundations" },
  4: { levelNumber: 4,  levelTitle: "Rote Verbal Counting to 10",               conceptId: "S1.4", stage: 1, ageGroup: "3-4", strand: "Number Sense" },
  5: { levelNumber: 5,  levelTitle: "Counting Small Sets (1-3)",                 conceptId: "S1.5", stage: 1, ageGroup: "3-4", strand: "Number Sense" },
  // Definition widened 2026-09-18 (PR #517 §5b, row 18): was "identical shapes only" -> now any size/orientation.
  6: { levelNumber: 6,  levelTitle: "Shape Matching (Perceptual, Any Size/Orientation)", conceptId: "S1.6", stage: 1, ageGroup: "3-4", strand: "Shapes & Spatial" },
  7: { levelNumber: 7,  levelTitle: "Perceptual Subitizing",                   conceptId: "S1.7", stage: 1, ageGroup: "3-4", strand: "Number Sense" },
  // New node, added 2026-09-19 per Pavani's ruling: NCF-FS-specified nodes are final,
  // not a judgment call -- adding a node NCF clearly specifies is never the hard part.
  // Split off S3.6 (see that entry's comment): NCF-FS C-8.4 Table 32 Column A (age 3-4)
  // states this as its own outcome, distinct from numeral-sequencing (C-8.3, age 5-6).
  8: { levelNumber: 8, levelTitle: "Arranges Familiar Events/Objects in Sequence", conceptId: "S1.8", stage: 1, ageGroup: "3-4", strand: "Pre-Number Foundations" },

  // --- Stage 2: Preschool 2 (Age 4-5) ---
  9: { levelNumber: 9,  levelTitle: "Quantity Comparison",                      conceptId: "S2.1", stage: 2, ageGroup: "4-5", strand: "Pre-Number Foundations" },
  10: { levelNumber: 10,  levelTitle: "Seriation (3 Objects)",                    conceptId: "S2.2", stage: 2, ageGroup: "4-5", strand: "Pre-Number Foundations" },
  11: { levelNumber: 11, levelTitle: "Classification (Increasing Complexity)",  conceptId: "S2.3", stage: 2, ageGroup: "4-5", strand: "Pre-Number Foundations" },
  12: { levelNumber: 12, levelTitle: "Counting to 5 (Cardinality)",               conceptId: "S2.4", stage: 2, ageGroup: "4-5", strand: "Number Sense" },
  13: { levelNumber: 13, levelTitle: "Counting 6-10",                            conceptId: "S2.5", stage: 2, ageGroup: "4-5", strand: "Number Sense" },
  14: { levelNumber: 14, levelTitle: "Shape Identification",                      conceptId: "S2.6", stage: 2, ageGroup: "4-5", strand: "Shapes & Spatial" },
  15: { levelNumber: 15, levelTitle: "2-Item Patterns",                           conceptId: "S2.7", stage: 2, ageGroup: "4-5", strand: "Patterns" },
  16: { levelNumber: 16, levelTitle: "Comparative Vocabulary",                    conceptId: "S2.8", stage: 2, ageGroup: "4-5", strand: "Measurement" },
  // Definition widened 2026-09-18 (PR #517 §5b, row 6): was ~4-6 objects -> now recognises up to 6 at a glance.
  17: { levelNumber: 17, levelTitle: "Conceptual Subitizing (to 6)",             conceptId: "S2.9", stage: 2, ageGroup: "4-5", strand: "Number Sense" },
  18: { levelNumber: 18, levelTitle: "Basic Shape Composition",                   conceptId: "S2.10", stage: 2, ageGroup: "4-5", strand: "Shapes & Spatial" },

  // --- Stage 3: The Year Before Class 1 ("Balvatika", Age 5-6) — finalised against NCF-FS, PR #517 ---
  19: { levelNumber: 19, levelTitle: "Numeral Recognition (1-10)",              conceptId: "S3.1", stage: 3, ageGroup: "5-6", strand: "Number Sense" },
  20: { levelNumber: 20, levelTitle: "Numeral-Quantity Correspondence",         conceptId: "S3.2", stage: 3, ageGroup: "5-6", strand: "Number Sense" },
  21: { levelNumber: 21, levelTitle: "Numeral Comparison (Object-Mediated)",     conceptId: "S3.3", stage: 3, ageGroup: "5-6", strand: "Pre-Number Foundations" },
  // Re-scoped 2026-09-19 per Pavani's decision on PR #517 §7's open item: NOT a split
  // from S2.2 (Seriation, 3 objects, no transitivity) -- that split already exists.
  // S3.4 previously bundled seriation with transitive inference (A>B, B>C => A>C),
  // which NCF-FS never states in the numeracy strand at any age column, and which
  // developmental literature places well past 5-6 (~7-9+). Re-scoped to exactly
  // NCF-FS C-8.4 Table 32 Column C (age 5-6): "arranges up to 5 objects by
  // size/length/weight in increasing or decreasing order." Transitive inference is
  // deliberately NOT assigned a stage -- NCF-FS doesn't cover it at all, so placing
  // it anywhere in the MVP (which stops at Class 3) would be a guess, not a sourced
  // decision. Also flagged: the S3.4 worksheet item in SPEC_missing_42_levels.md:207
  // (three sticks, "circle the longest") tests perceptual comparison, not withheld-
  // comparison transitive inference -- a pre-existing content bug, worth fixing
  // regardless of this re-scope, now tracked as a follow-up.
  22: { levelNumber: 22, levelTitle: "Seriation (Up to 5 Objects, by Size/Length/Weight)", conceptId: "S3.4", stage: 3, ageGroup: "5-6", strand: "Pre-Number Foundations" },
  23: { levelNumber: 23, levelTitle: "Flexible Classification",                 conceptId: "S3.5", stage: 3, ageGroup: "5-6", strand: "Pre-Number Foundations" },
  // Re-scoped 2026-09-19 per Pavani's ruling (NCF-FS-specified nodes are final): was bundled
  // with event/object sequencing, now split out to S1.8 (age 3-4, NCF-FS C-8.4 Column A).
  // S3.6 itself now scoped exactly to NCF-FS C-8.3 Table 31 Column C (age 5-6): "Says/sings
  // number names in correct sequence up to 20." The bundled NIPUN Bharat Balvatika target
  // ("arranges numbers/objects/shapes/occurrence of events in a sequence") is a single
  // assessable pass-mark competency covering BOTH this node and S1.8 -- whatever computes
  // the "Ready for Class 1" NIPUN readiness band must require both, not just this one.
  24: { levelNumber: 24, levelTitle: "Numeral Sequencing",                       conceptId: "S3.6", stage: 3, ageGroup: "5-6", strand: "Number Sense" },
  25: { levelNumber: 25, levelTitle: "Comparative Vocabulary (Formalizing)",    conceptId: "S3.7", stage: 3, ageGroup: "5-6", strand: "Measurement" },
  // No exact NCF-FS column-C outcome (PR #517 §7) — NCF-FS places extending patterns a column earlier; outcomes are cumulative so it still applies.
  26: { levelNumber: 26, levelTitle: "Patterns (2-Item Indep & 3-Item Intro)",  conceptId: "S3.8", stage: 3, ageGroup: "5-6", strand: "Patterns" },
  // No exact NCF-FS column-C outcome (PR #517 §7) — NCF-FS places shape pictures a column earlier; outcomes are cumulative so it still applies.
  27: { levelNumber: 27, levelTitle: "Shape Composition & Decomposition",        conceptId: "S3.10", stage: 3, ageGroup: "5-6", strand: "Shapes & Spatial" },

  // New nodes, split off later-stage nodes (PR #517 §5d) — the later node keeps its own content/links.
  28: { levelNumber: 28, levelTitle: "Number Names to 20 (Rote)",                conceptId: "S3.11", stage: 3, ageGroup: "5-6", strand: "Number Sense" },
  // New node, not a split (PR #517 §5e) — Gelman & Gallistel (1978) order-irrelevance principle.
  29: { levelNumber: 29, levelTitle: "Counts in Any Order (Order Irrelevance)",  conceptId: "S3.12", stage: 3, ageGroup: "5-6", strand: "Number Sense" },
  30: { levelNumber: 30, levelTitle: "Writes Numerals to 9",                     conceptId: "S3.13", stage: 3, ageGroup: "5-6", strand: "Number Sense" },
  31: { levelNumber: 31, levelTitle: "Combines Groups to 9 (Object-Based, No Symbol)", conceptId: "S3.14", stage: 3, ageGroup: "5-6", strand: "Number Operations" },
  32: { levelNumber: 32, levelTitle: "Takes Away to 9 (Object-Based, No Symbol)", conceptId: "S3.15", stage: 3, ageGroup: "5-6", strand: "Number Operations" },
  33: { levelNumber: 33, levelTitle: "Makes Groups & Counts Objects/Groups",     conceptId: "S3.16", stage: 3, ageGroup: "5-6", strand: "Number Operations" },
  34: { levelNumber: 34, levelTitle: "Shares Objects Equally (Up to 20, Among 4-5)", conceptId: "S3.17", stage: 3, ageGroup: "5-6", strand: "Number Operations" },
  // New node, not a split (PR #517 §5e).
  35: { levelNumber: 35, levelTitle: "Creates a New Pattern",                    conceptId: "S3.18", stage: 3, ageGroup: "5-6", strand: "Patterns" },
  36: { levelNumber: 36, levelTitle: "Describes a Repeating Pattern's Rule",     conceptId: "S3.19", stage: 3, ageGroup: "5-6", strand: "Patterns" },
  37: { levelNumber: 37, levelTitle: "Describes 3D Solids in Own Words",         conceptId: "S3.20", stage: 3, ageGroup: "5-6", strand: "Shapes & Spatial" },
  38: { levelNumber: 38, levelTitle: "Traces Faces of 3D Objects",               conceptId: "S3.21", stage: 3, ageGroup: "5-6", strand: "Shapes & Spatial" },
  // New node, not a split (PR #517 §5e).
  39: { levelNumber: 39, levelTitle: "Draws 2D Shapes Freehand",                 conceptId: "S3.22", stage: 3, ageGroup: "5-6", strand: "Shapes & Spatial" },
  40: { levelNumber: 40, levelTitle: "Compares Capacity of Two Vessels",         conceptId: "S3.23", stage: 3, ageGroup: "5-6", strand: "Measurement" },
  41: { levelNumber: 41, levelTitle: "Names Days of the Week & Months",          conceptId: "S3.24", stage: 3, ageGroup: "5-6", strand: "Calendar & Time" },
  // New node, not a split (PR #517 §5e).
  42: { levelNumber: 42, levelTitle: "Solves Simple Number Riddles/Puzzles",     conceptId: "S3.25", stage: 3, ageGroup: "5-6", strand: "Number Sense" },

  // Moved in from later stages 2026-09-18 (PR #517 §5c) — stage label only; S-code and prerequisite links unchanged
  // unless noted at the source entry. Formerly S4.12/S4.13 (Class 1) and S5.9/S5.13 (Class 2).
  43: { levelNumber: 43, levelTitle: "Concept of Zero",                          conceptId: "S4.12", stage: 3, ageGroup: "5-6", strand: "Number Sense" },
  44: { levelNumber: 44, levelTitle: "Ordinal Positions (1st-10th)",             conceptId: "S4.13", stage: 3, ageGroup: "5-6", strand: "Number Sense" },
  45: { levelNumber: 45, levelTitle: "Currency Recognition",                     conceptId: "S5.9",  stage: 3, ageGroup: "5-6", strand: "Money" },
  // Moving this node makes the old S5.12 -> S5.13 edge point backwards; PR #517 §5c/§9 says delete that edge in competencyPrerequisites.ts.
  46: { levelNumber: 46, levelTitle: "Spatial Vocabulary",                       conceptId: "S5.13", stage: 3, ageGroup: "5-6", strand: "Shapes & Spatial" },

  // --- Stage 4: Class 1 (Age 6-7) --- (S4.12 Zero, S4.13 Ordinal moved out to Stage 3, PR #517)
  47: { levelNumber: 47, levelTitle: "Abstract Numeral Comparison",              conceptId: "S4.1", stage: 4, ageGroup: "6-7", strand: "Number Sense" },
  48: { levelNumber: 48, levelTitle: "Close Numeral Comparison",                 conceptId: "S4.2", stage: 4, ageGroup: "6-7", strand: "Number Sense" },
  49: { levelNumber: 49, levelTitle: "Counting Objects to 20",                   conceptId: "S4.3", stage: 4, ageGroup: "6-7", strand: "Number Sense" },
  50: { levelNumber: 50, levelTitle: "Reading & Writing Numerals to 99",         conceptId: "S4.4", stage: 4, ageGroup: "6-7", strand: "Number Sense" },
  51: { levelNumber: 51, levelTitle: "Tens and Ones",                            conceptId: "S4.5", stage: 4, ageGroup: "6-7", strand: "Number Sense" },
  52: { levelNumber: 52, levelTitle: "Single-Digit Addition",                    conceptId: "S4.6", stage: 4, ageGroup: "6-7", strand: "Number Operations" },
  53: { levelNumber: 53, levelTitle: "Single-Digit Subtraction",                  conceptId: "S4.7", stage: 4, ageGroup: "6-7", strand: "Number Operations" },
  54: { levelNumber: 54, levelTitle: "3D Shape Properties",                      conceptId: "S4.8", stage: 4, ageGroup: "6-7", strand: "Shapes & Spatial" },
  // Moved 2026-09-19 from Stage 3 per Pavani's ruling (NCF-FS-specified placement is final):
  // formal named-shape vocabulary ("sides", "corners", named shapes) is NCF-FS C-8.8 Column E
  // (age 7-8), not Column C (5-6) -- Column C is informal description only ("a ball rolls and
  // has no corners"), already correctly covered by the new S3.20. Retitled to match Column E's
  // 2D line exactly: "Identifies 2D shapes by their names... describes their observable
  // characteristics (e.g., the pages of a book are rectangular and have 4 sides, 4 corners)."
  // Parallels S4.8 immediately above, which covers Column E's 3D line the same way. No repo
  // content existed against the old S3.9 placement, so this move retires nothing live.
  55: { levelNumber: 55, levelTitle: "2D Shape Identification & Properties (Named Shapes)", conceptId: "S3.9", stage: 4, ageGroup: "6-7", strand: "Shapes & Spatial" },
  56: { levelNumber: 56, levelTitle: "Non-Standard Length Estimation",          conceptId: "S4.9", stage: 4, ageGroup: "6-7", strand: "Measurement" },
  57: { levelNumber: 57, levelTitle: "Non-Standard Capacity Estimation",        conceptId: "S4.10", stage: 4, ageGroup: "6-7", strand: "Measurement" },
  58: { levelNumber: 58, levelTitle: "3-Item Pattern Completion",               conceptId: "S4.11", stage: 4, ageGroup: "6-7", strand: "Patterns" },
  59: { levelNumber: 59, levelTitle: "Informal Number Line (0-20)",              conceptId: "S4.14", stage: 4, ageGroup: "6-7", strand: "Number Sense" },
  60: { levelNumber: 60, levelTitle: "Advanced Shape Composition",               conceptId: "S4.15", stage: 4, ageGroup: "6-7", strand: "Shapes & Spatial" },

  // --- Stage 5: Class 2 (Age 7-8) --- (S5.9 Currency, S5.13 Spatial Vocabulary moved out to Stage 3, PR #517)
  61: { levelNumber: 61, levelTitle: "Reading & Writing 3-Digit Numbers",        conceptId: "S5.1", stage: 5, ageGroup: "7-8", strand: "Number Sense" },
  62: { levelNumber: 62, levelTitle: "Tens as Bundles/Groups",                   conceptId: "S5.2", stage: 5, ageGroup: "7-8", strand: "Number Sense" },
  63: { levelNumber: 63, levelTitle: "Flexible 2-Digit Decomposition",          conceptId: "S5.3", stage: 5, ageGroup: "7-8", strand: "Number Sense" },
  64: { levelNumber: 64, levelTitle: "2-Digit Addition with Regrouping",          conceptId: "S5.4", stage: 5, ageGroup: "7-8", strand: "Number Operations" },
  65: { levelNumber: 65, levelTitle: "2-Digit Subtraction with Regrouping",       conceptId: "S5.5", stage: 5, ageGroup: "7-8", strand: "Number Operations" },
  66: { levelNumber: 66, levelTitle: "Multiplication as Repeated Addition",      conceptId: "S5.6", stage: 5, ageGroup: "7-8", strand: "Number Operations" },
  67: { levelNumber: 67, levelTitle: "Division as Equal Sharing",                conceptId: "S5.7", stage: 5, ageGroup: "7-8", strand: "Number Operations" },
  68: { levelNumber: 68, levelTitle: "Multiplication Tables (2,3,4,5,10)",       conceptId: "S5.8", stage: 5, ageGroup: "7-8", strand: "Number Operations" },
  69: { levelNumber: 69, levelTitle: "Informal Fractions (Folding)",             conceptId: "S5.10", stage: 5, ageGroup: "7-8", strand: "Fractions" },
  70: { levelNumber: 70, levelTitle: "Uniform Non-Standard Measurement",        conceptId: "S5.11", stage: 5, ageGroup: "7-8", strand: "Measurement" },
  71: { levelNumber: 71, levelTitle: "2D Shape Set Identification",              conceptId: "S5.12", stage: 5, ageGroup: "7-8", strand: "Shapes & Spatial" },
  72: { levelNumber: 72, levelTitle: "Calendar Reading",                         conceptId: "S5.14", stage: 5, ageGroup: "7-8", strand: "Calendar & Time" },
  73: { levelNumber: 73, levelTitle: "Data Handling (Sorting & Tallies)",        conceptId: "S5.15", stage: 5, ageGroup: "7-8", strand: "Data Handling" },
  74: { levelNumber: 74, levelTitle: "Number Patterns & Sequences",             conceptId: "S5.16", stage: 5, ageGroup: "7-8", strand: "Patterns" },
  75: { levelNumber: 75, levelTitle: "Zero as a Placeholder",                    conceptId: "S5.17", stage: 5, ageGroup: "7-8", strand: "Number Sense" },
  76: { levelNumber: 76, levelTitle: "Extended Number Line (0-100)",             conceptId: "S5.18", stage: 5, ageGroup: "7-8", strand: "Number Sense" },
  77: { levelNumber: 77, levelTitle: "Skip Counting (2s, 5s, 10s)",              conceptId: "S5.19", stage: 5, ageGroup: "7-8", strand: "Patterns" },

  // --- Stage 6: Class 3 (Age 8-9) ★ MPL --- (unchanged by PR #517)
  78: { levelNumber: 78, levelTitle: "3-Digit Place Value & Expanded Form",       conceptId: "S6.1", stage: 6, ageGroup: "8-9", strand: "Number Sense" },
  79: { levelNumber: 79, levelTitle: "Flexible 3-Digit Decomposition",          conceptId: "S6.2", stage: 6, ageGroup: "8-9", strand: "Number Sense" },
  80: { levelNumber: 80, levelTitle: "3-Digit Comparison & Ordering",            conceptId: "S6.3", stage: 6, ageGroup: "8-9", strand: "Number Sense" },
  81: { levelNumber: 81, levelTitle: "Reading & Writing 4-Digit Numbers",         conceptId: "S6.4", stage: 6, ageGroup: "8-9", strand: "Number Sense" },
  82: { levelNumber: 82, levelTitle: "3-Digit Addition & Subtraction Problems",  conceptId: "S6.5", stage: 6, ageGroup: "8-9", strand: "Number Operations" },
  83: { levelNumber: 83, levelTitle: "Full Multiplication Tables (2-10)",        conceptId: "S6.6", stage: 6, ageGroup: "8-9", strand: "Number Operations" },
  84: { levelNumber: 84, levelTitle: "Division Facts & Inverse Relation",         conceptId: "S6.7", stage: 6, ageGroup: "8-9", strand: "Number Operations" },
  85: { levelNumber: 85, levelTitle: "Standard Measurement Units",               conceptId: "S6.8", stage: 6, ageGroup: "8-9", strand: "Measurement" },
  86: { levelNumber: 86, levelTitle: "Relating 2D Faces to 3D Solids",          conceptId: "S6.9", stage: 6, ageGroup: "8-9", strand: "Shapes & Spatial" },
  87: { levelNumber: 87, levelTitle: "Telling Time (Hours & Half-Hours)",        conceptId: "S6.10", stage: 6, ageGroup: "8-9", strand: "Calendar & Time" },
  88: { levelNumber: 88, levelTitle: "Money Arithmetic",                         conceptId: "S6.11", stage: 6, ageGroup: "8-9", strand: "Money" },
  89: { levelNumber: 89, levelTitle: "Formal Fractions (Half/Quarter)",          conceptId: "S6.12", stage: 6, ageGroup: "8-9", strand: "Fractions" },
  90: { levelNumber: 90, levelTitle: "Pattern Rules & Generalization",           conceptId: "S6.13", stage: 6, ageGroup: "8-9", strand: "Patterns" },
  91: { levelNumber: 91, levelTitle: "Data Handling (Pictographs & Bar Graphs)", conceptId: "S6.14", stage: 6, ageGroup: "8-9", strand: "Data Handling" },

  // --- Stage 7: Class 4 (Age 9-10) --- (unchanged by PR #517; out of MVP scope per fln_year_before_class1.md §8)
  92: { levelNumber: 92,  levelTitle: "4-Digit & 5-Digit Place Value",           conceptId: "S7.1", stage: 7, ageGroup: "9-10", strand: "Number Sense" },
  93: { levelNumber: 93,  levelTitle: "Large Number Operations & Regrouping",    conceptId: "S7.2", stage: 7, ageGroup: "9-10", strand: "Number Sense" },
  94: { levelNumber: 94,  levelTitle: "Complex Multi-Digit Word Problems",        conceptId: "S7.3", stage: 7, ageGroup: "9-10", strand: "Number Operations" },
  95: { levelNumber: 95,  levelTitle: "Extended Multiplication",                 conceptId: "S7.4", stage: 7, ageGroup: "9-10", strand: "Number Operations" },
  96: { levelNumber: 96,  levelTitle: "Formal Long Division",                     conceptId: "S7.5", stage: 7, ageGroup: "9-10", strand: "Number Operations" },
  97: { levelNumber: 97,  levelTitle: "Fractional Notation & Equivalence",        conceptId: "S7.6", stage: 7, ageGroup: "9-10", strand: "Fractions" },
  98: { levelNumber: 98,  levelTitle: "Standard Unit Conversion",                conceptId: "S7.7", stage: 7, ageGroup: "9-10", strand: "Measurement" },
  99: { levelNumber: 99,  levelTitle: "Applied Measurement Word Problems",        conceptId: "S7.8", stage: 7, ageGroup: "9-10", strand: "Measurement" },
  100: { levelNumber: 100,  levelTitle: "3D Nets & Spatial Perspective",            conceptId: "S7.9", stage: 7, ageGroup: "9-10", strand: "Shapes & Spatial" },
  101: { levelNumber: 101, levelTitle: "Advanced Time Calculation",               conceptId: "S7.10", stage: 7, ageGroup: "9-10", strand: "Calendar & Time" },
  102: { levelNumber: 102, levelTitle: "Complex Money Problems",                   conceptId: "S7.11", stage: 7, ageGroup: "9-10", strand: "Money" },
  103: { levelNumber: 103, levelTitle: "Advanced Number Patterns",                conceptId: "S7.12", stage: 7, ageGroup: "9-10", strand: "Patterns" },
  104: { levelNumber: 104, levelTitle: "Bar Graphs & Data Interpretation",         conceptId: "S7.13", stage: 7, ageGroup: "9-10", strand: "Data Handling" },
  105: { levelNumber: 105, levelTitle: "Factors & Multiples",                      conceptId: "S7.14", stage: 7, ageGroup: "9-10", strand: "Number Operations" },
  106: { levelNumber: 106, levelTitle: "Decimals (Tenths & Hundredths)",           conceptId: "S7.15", stage: 7, ageGroup: "9-10", strand: "Number Sense" },
  107: { levelNumber: 107, levelTitle: "Angles & Turn",                            conceptId: "S7.16", stage: 7, ageGroup: "9-10", strand: "Shapes & Spatial" },
  108: { levelNumber: 108, levelTitle: "Symmetry & Reflection",                    conceptId: "S7.17", stage: 7, ageGroup: "9-10", strand: "Shapes & Spatial" },
  109: { levelNumber: 109, levelTitle: "Perimeter & Area",                         conceptId: "S7.18", stage: 7, ageGroup: "9-10", strand: "Measurement" },
};

// Build reverse lookup: Concept ID -> Level Number
const CONCEPT_TO_LEVEL: Record<string, LevelConceptConfig> = {};
for (const config of Object.values(CURRICULUM_MAPPING)) {
  CONCEPT_TO_LEVEL[config.conceptId] = config;
}

/**
 * Get Level configuration by Curriculum Level Number
 */
export function getConceptForLevel(levelNumber: number): LevelConceptConfig | undefined {
  return CURRICULUM_MAPPING[levelNumber];
}

/**
 * Get Level configuration by Concept ID (e.g. "S3.3")
 */
export function getLevelForConcept(conceptId: string): LevelConceptConfig | undefined {
  return CONCEPT_TO_LEVEL[conceptId];
}
