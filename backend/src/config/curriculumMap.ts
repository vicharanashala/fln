export interface LevelConceptConfig {
  levelNumber: number;
  levelTitle: string;
  conceptId: string;
  stage: number;
  ageGroup: string;
  strand: string;
}

/**
 * Master Registry mapping 93 Curriculum Level Numbers <-> Concept IDs (S1.1 - S7.18).
 * Re-ordering levels in the curriculum requires ONLY changing the levelNumber assignment here.
 */
export const CURRICULUM_MAPPING: Record<number, LevelConceptConfig> = {
  // --- Stage 1: Preschool 1 (Age 3-4) ---
  1:  { levelNumber: 1,  levelTitle: "One-to-One Correspondence",              conceptId: "S1.1", stage: 1, ageGroup: "3-4", strand: "Pre-Number Foundations" },
  2:  { levelNumber: 2,  levelTitle: "Classification (Single Property)",         conceptId: "S1.2", stage: 1, ageGroup: "3-4", strand: "Pre-Number Foundations" },
  3:  { levelNumber: 3,  levelTitle: "Perceptual Same/Different",                conceptId: "S1.3", stage: 1, ageGroup: "3-4", strand: "Pre-Number Foundations" },
  4:  { levelNumber: 4,  levelTitle: "Rote Verbal Counting to 10",               conceptId: "S1.4", stage: 1, ageGroup: "3-4", strand: "Number Sense" },
  5:  { levelNumber: 5,  levelTitle: "Counting Small Sets (1-3)",                 conceptId: "S1.5", stage: 1, ageGroup: "3-4", strand: "Number Sense" },
  6:  { levelNumber: 6,  levelTitle: "Shape Matching (Perceptual)",              conceptId: "S1.6", stage: 1, ageGroup: "3-4", strand: "Shapes & Spatial" },
  7:  { levelNumber: 7,  levelTitle: "Perceptual Subitizing",                   conceptId: "S1.7", stage: 1, ageGroup: "3-4", strand: "Number Sense" },

  // --- Stage 2: Preschool 2 (Age 4-5) ---
  8:  { levelNumber: 8,  levelTitle: "Quantity Comparison",                      conceptId: "S2.1", stage: 2, ageGroup: "4-5", strand: "Pre-Number Foundations" },
  9:  { levelNumber: 9,  levelTitle: "Seriation (3 Objects)",                    conceptId: "S2.2", stage: 2, ageGroup: "4-5", strand: "Pre-Number Foundations" },
  10: { levelNumber: 10, levelTitle: "Classification (Increasing Complexity)",  conceptId: "S2.3", stage: 2, ageGroup: "4-5", strand: "Pre-Number Foundations" },
  11: { levelNumber: 11, levelTitle: "Counting to 5 (Cardinality)",               conceptId: "S2.4", stage: 2, ageGroup: "4-5", strand: "Number Sense" },
  12: { levelNumber: 12, levelTitle: "Counting 6-10",                            conceptId: "S2.5", stage: 2, ageGroup: "4-5", strand: "Number Sense" },
  13: { levelNumber: 13, levelTitle: "Shape Identification",                      conceptId: "S2.6", stage: 2, ageGroup: "4-5", strand: "Shapes & Spatial" },
  14: { levelNumber: 14, levelTitle: "2-Item Patterns",                           conceptId: "S2.7", stage: 2, ageGroup: "4-5", strand: "Patterns" },
  15: { levelNumber: 15, levelTitle: "Comparative Vocabulary",                    conceptId: "S2.8", stage: 2, ageGroup: "4-5", strand: "Measurement" },
  16: { levelNumber: 16, levelTitle: "Conceptual Subitizing",                   conceptId: "S2.9", stage: 2, ageGroup: "4-5", strand: "Number Sense" },
  17: { levelNumber: 17, levelTitle: "Basic Shape Composition",                   conceptId: "S2.10", stage: 2, ageGroup: "4-5", strand: "Shapes & Spatial" },

  // --- Stage 3: Preschool 3 / Balvatika (Age 5-6) ---
  18: { levelNumber: 18, levelTitle: "Numeral Recognition (1-10)",              conceptId: "S3.1", stage: 3, ageGroup: "5-6", strand: "Number Sense" },
  19: { levelNumber: 19, levelTitle: "Numeral-Quantity Correspondence",         conceptId: "S3.2", stage: 3, ageGroup: "5-6", strand: "Number Sense" },
  20: { levelNumber: 20, levelTitle: "Numeral Comparison (Object-Mediated)",     conceptId: "S3.3", stage: 3, ageGroup: "5-6", strand: "Pre-Number Foundations" },
  21: { levelNumber: 21, levelTitle: "Seriation with Transitivity",              conceptId: "S3.4", stage: 3, ageGroup: "5-6", strand: "Pre-Number Foundations" },
  22: { levelNumber: 22, levelTitle: "Flexible Classification",                 conceptId: "S3.5", stage: 3, ageGroup: "5-6", strand: "Pre-Number Foundations" },
  23: { levelNumber: 23, levelTitle: "Numeral Sequencing",                       conceptId: "S3.6", stage: 3, ageGroup: "5-6", strand: "Number Sense" },
  24: { levelNumber: 24, levelTitle: "Comparative Vocabulary (Formalizing)",    conceptId: "S3.7", stage: 3, ageGroup: "5-6", strand: "Measurement" },
  25: { levelNumber: 25, levelTitle: "Patterns (2-Item Indep & 3-Item Intro)",  conceptId: "S3.8", stage: 3, ageGroup: "5-6", strand: "Patterns" },
  26: { levelNumber: 26, levelTitle: "Basic Shape Properties",                   conceptId: "S3.9", stage: 3, ageGroup: "5-6", strand: "Shapes & Spatial" },
  27: { levelNumber: 27, levelTitle: "Shape Composition & Decomposition",        conceptId: "S3.10", stage: 3, ageGroup: "5-6", strand: "Shapes & Spatial" },

  // --- Stage 4: Class 1 (Age 6-7) ---
  28: { levelNumber: 28, levelTitle: "Abstract Numeral Comparison",              conceptId: "S4.1", stage: 4, ageGroup: "6-7", strand: "Number Sense" },
  29: { levelNumber: 29, levelTitle: "Close Numeral Comparison",                 conceptId: "S4.2", stage: 4, ageGroup: "6-7", strand: "Number Sense" },
  30: { levelNumber: 30, levelTitle: "Counting Objects to 20",                   conceptId: "S4.3", stage: 4, ageGroup: "6-7", strand: "Number Sense" },
  31: { levelNumber: 31, levelTitle: "Reading & Writing Numerals to 99",         conceptId: "S4.4", stage: 4, ageGroup: "6-7", strand: "Number Sense" },
  32: { levelNumber: 32, levelTitle: "Tens and Ones",                            conceptId: "S4.5", stage: 4, ageGroup: "6-7", strand: "Number Sense" },
  33: { levelNumber: 33, levelTitle: "Single-Digit Addition",                    conceptId: "S4.6", stage: 4, ageGroup: "6-7", strand: "Number Operations" },
  34: { levelNumber: 34, levelTitle: "Single-Digit Subtraction",                  conceptId: "S4.7", stage: 4, ageGroup: "6-7", strand: "Number Operations" },
  35: { levelNumber: 35, levelTitle: "3D Shape Properties",                      conceptId: "S4.8", stage: 4, ageGroup: "6-7", strand: "Shapes & Spatial" },
  36: { levelNumber: 36, levelTitle: "Non-Standard Length Estimation",          conceptId: "S4.9", stage: 4, ageGroup: "6-7", strand: "Measurement" },
  37: { levelNumber: 37, levelTitle: "Non-Standard Capacity Estimation",        conceptId: "S4.10", stage: 4, ageGroup: "6-7", strand: "Measurement" },
  38: { levelNumber: 38, levelTitle: "3-Item Pattern Completion",               conceptId: "S4.11", stage: 4, ageGroup: "6-7", strand: "Patterns" },
  39: { levelNumber: 39, levelTitle: "Concept of Zero",                          conceptId: "S4.12", stage: 4, ageGroup: "6-7", strand: "Number Sense" },
  40: { levelNumber: 40, levelTitle: "Ordinal Positions (1st-10th)",             conceptId: "S4.13", stage: 4, ageGroup: "6-7", strand: "Number Sense" },
  41: { levelNumber: 41, levelTitle: "Informal Number Line (0-20)",              conceptId: "S4.14", stage: 4, ageGroup: "6-7", strand: "Number Sense" },
  42: { levelNumber: 42, levelTitle: "Advanced Shape Composition",               conceptId: "S4.15", stage: 4, ageGroup: "6-7", strand: "Shapes & Spatial" },

  // --- Stage 5: Class 2 (Age 7-8) ---
  43: { levelNumber: 43, levelTitle: "Reading & Writing 3-Digit Numbers",        conceptId: "S5.1", stage: 5, ageGroup: "7-8", strand: "Number Sense" },
  44: { levelNumber: 44, levelTitle: "Tens as Bundles/Groups",                   conceptId: "S5.2", stage: 5, ageGroup: "7-8", strand: "Number Sense" },
  45: { levelNumber: 45, levelTitle: "Flexible 2-Digit Decomposition",          conceptId: "S5.3", stage: 5, ageGroup: "7-8", strand: "Number Sense" },
  46: { levelNumber: 46, levelTitle: "2-Digit Addition with Regrouping",          conceptId: "S5.4", stage: 5, ageGroup: "7-8", strand: "Number Operations" },
  47: { levelNumber: 47, levelTitle: "2-Digit Subtraction with Regrouping",       conceptId: "S5.5", stage: 5, ageGroup: "7-8", strand: "Number Operations" },
  48: { levelNumber: 48, levelTitle: "Multiplication as Repeated Addition",      conceptId: "S5.6", stage: 5, ageGroup: "7-8", strand: "Number Operations" },
  49: { levelNumber: 49, levelTitle: "Division as Equal Sharing",                conceptId: "S5.7", stage: 5, ageGroup: "7-8", strand: "Number Operations" },
  50: { levelNumber: 50, levelTitle: "Multiplication Tables (2,3,4,5,10)",       conceptId: "S5.8", stage: 5, ageGroup: "7-8", strand: "Number Operations" },
  51: { levelNumber: 51, levelTitle: "Currency Recognition",                     conceptId: "S5.9", stage: 5, ageGroup: "7-8", strand: "Money" },
  52: { levelNumber: 52, levelTitle: "Informal Fractions (Folding)",             conceptId: "S5.10", stage: 5, ageGroup: "7-8", strand: "Fractions" },
  53: { levelNumber: 53, levelTitle: "Uniform Non-Standard Measurement",        conceptId: "S5.11", stage: 5, ageGroup: "7-8", strand: "Measurement" },
  54: { levelNumber: 54, levelTitle: "2D Shape Set Identification",              conceptId: "S5.12", stage: 5, ageGroup: "7-8", strand: "Shapes & Spatial" },
  55: { levelNumber: 55, levelTitle: "Spatial Vocabulary",                       conceptId: "S5.13", stage: 5, ageGroup: "7-8", strand: "Shapes & Spatial" },
  56: { levelNumber: 56, levelTitle: "Calendar Reading",                         conceptId: "S5.14", stage: 5, ageGroup: "7-8", strand: "Calendar & Time" },
  57: { levelNumber: 57, levelTitle: "Data Handling (Sorting & Tallies)",        conceptId: "S5.15", stage: 5, ageGroup: "7-8", strand: "Data Handling" },
  58: { levelNumber: 58, levelTitle: "Number Patterns & Sequences",             conceptId: "S5.16", stage: 5, ageGroup: "7-8", strand: "Patterns" },
  59: { levelNumber: 59, levelTitle: "Zero as a Placeholder",                    conceptId: "S5.17", stage: 5, ageGroup: "7-8", strand: "Number Sense" },
  60: { levelNumber: 60, levelTitle: "Extended Number Line (0-100)",             conceptId: "S5.18", stage: 5, ageGroup: "7-8", strand: "Number Sense" },
  61: { levelNumber: 61, levelTitle: "Skip Counting (2s, 5s, 10s)",              conceptId: "S5.19", stage: 5, ageGroup: "7-8", strand: "Patterns" },

  // --- Stage 6: Class 3 (Age 8-9) ★ MPL ---
  62: { levelNumber: 62, levelTitle: "3-Digit Place Value & Expanded Form",       conceptId: "S6.1", stage: 6, ageGroup: "8-9", strand: "Number Sense" },
  63: { levelNumber: 63, levelTitle: "Flexible 3-Digit Decomposition",          conceptId: "S6.2", stage: 6, ageGroup: "8-9", strand: "Number Sense" },
  64: { levelNumber: 64, levelTitle: "3-Digit Comparison & Ordering",            conceptId: "S6.3", stage: 6, ageGroup: "8-9", strand: "Number Sense" },
  65: { levelNumber: 65, levelTitle: "Reading & Writing 4-Digit Numbers",         conceptId: "S6.4", stage: 6, ageGroup: "8-9", strand: "Number Sense" },
  66: { levelNumber: 66, levelTitle: "3-Digit Addition & Subtraction Problems",  conceptId: "S6.5", stage: 6, ageGroup: "8-9", strand: "Number Operations" },
  67: { levelNumber: 67, levelTitle: "Full Multiplication Tables (2-10)",        conceptId: "S6.6", stage: 6, ageGroup: "8-9", strand: "Number Operations" },
  68: { levelNumber: 68, levelTitle: "Division Facts & Inverse Relation",         conceptId: "S6.7", stage: 6, ageGroup: "8-9", strand: "Number Operations" },
  69: { levelNumber: 69, levelTitle: "Standard Measurement Units",               conceptId: "S6.8", stage: 6, ageGroup: "8-9", strand: "Measurement" },
  70: { levelNumber: 70, levelTitle: "Relating 2D Faces to 3D Solids",          conceptId: "S6.9", stage: 6, ageGroup: "8-9", strand: "Shapes & Spatial" },
  71: { levelNumber: 71, levelTitle: "Telling Time (Hours & Half-Hours)",        conceptId: "S6.10", stage: 6, ageGroup: "8-9", strand: "Calendar & Time" },
  72: { levelNumber: 72, levelTitle: "Money Arithmetic",                         conceptId: "S6.11", stage: 6, ageGroup: "8-9", strand: "Money" },
  73: { levelNumber: 73, levelTitle: "Formal Fractions (Half/Quarter)",          conceptId: "S6.12", stage: 6, ageGroup: "8-9", strand: "Fractions" },
  74: { levelNumber: 74, levelTitle: "Pattern Rules & Generalization",           conceptId: "S6.13", stage: 6, ageGroup: "8-9", strand: "Patterns" },
  75: { levelNumber: 75, levelTitle: "Data Handling (Pictographs & Bar Graphs)", conceptId: "S6.14", stage: 6, ageGroup: "8-9", strand: "Data Handling" },

  // --- Stage 7: Class 4 (Age 9-10) ---
  76: { levelNumber: 76, levelTitle: "4-Digit & 5-Digit Place Value",           conceptId: "S7.1", stage: 7, ageGroup: "9-10", strand: "Number Sense" },
  77: { levelNumber: 77, levelTitle: "Large Number Operations & Regrouping",    conceptId: "S7.2", stage: 7, ageGroup: "9-10", strand: "Number Sense" },
  78: { levelNumber: 78, levelTitle: "Complex Multi-Digit Word Problems",        conceptId: "S7.3", stage: 7, ageGroup: "9-10", strand: "Number Operations" },
  79: { levelNumber: 79, levelTitle: "Extended Multiplication",                 conceptId: "S7.4", stage: 7, ageGroup: "9-10", strand: "Number Operations" },
  80: { levelNumber: 80, levelTitle: "Formal Long Division",                     conceptId: "S7.5", stage: 7, ageGroup: "9-10", strand: "Number Operations" },
  81: { levelNumber: 81, levelTitle: "Fractional Notation & Equivalence",        conceptId: "S7.6", stage: 7, ageGroup: "9-10", strand: "Fractions" },
  82: { levelNumber: 82, levelTitle: "Standard Unit Conversion",                conceptId: "S7.7", stage: 7, ageGroup: "9-10", strand: "Measurement" },
  83: { levelNumber: 83, levelTitle: "Applied Measurement Word Problems",        conceptId: "S7.8", stage: 7, ageGroup: "9-10", strand: "Measurement" },
  84: { levelNumber: 84, levelTitle: "3D Nets & Spatial Perspective",            conceptId: "S7.9", stage: 7, ageGroup: "9-10", strand: "Shapes & Spatial" },
  85: { levelNumber: 85, levelTitle: "Advanced Time Calculation",               conceptId: "S7.10", stage: 7, ageGroup: "9-10", strand: "Calendar & Time" },
  86: { levelNumber: 86, levelTitle: "Complex Money Problems",                   conceptId: "S7.11", stage: 7, ageGroup: "9-10", strand: "Money" },
  87: { levelNumber: 87, levelTitle: "Advanced Number Patterns",                conceptId: "S7.12", stage: 7, ageGroup: "9-10", strand: "Patterns" },
  88: { levelNumber: 88, levelTitle: "Bar Graphs & Data Interpretation",         conceptId: "S7.13", stage: 7, ageGroup: "9-10", strand: "Data Handling" },
  89: { levelNumber: 89, levelTitle: "Factors & Multiples",                      conceptId: "S7.14", stage: 7, ageGroup: "9-10", strand: "Number Operations" },
  90: { levelNumber: 90, levelTitle: "Decimals (Tenths & Hundredths)",           conceptId: "S7.15", stage: 7, ageGroup: "9-10", strand: "Number Sense" },
  91: { levelNumber: 91, levelTitle: "Angles & Turn",                            conceptId: "S7.16", stage: 7, ageGroup: "9-10", strand: "Shapes & Spatial" },
  92: { levelNumber: 92, levelTitle: "Symmetry & Reflection",                    conceptId: "S7.17", stage: 7, ageGroup: "9-10", strand: "Shapes & Spatial" },
  93: { levelNumber: 93, levelTitle: "Perimeter & Area",                         conceptId: "S7.18", stage: 7, ageGroup: "9-10", strand: "Measurement" },
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
