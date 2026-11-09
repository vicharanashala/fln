// Skill framework: 24 core skills (SK01-SK24), their subskills, and which skills each of the 109 levels teaches.
// Ported from the live FLN repo (frontend/src/data/skillProgressionMap.ts) by script, not retyped; the script also
// checked that all 109 levels and concept codes agree with curriculumMap.ts and that no skill id is unknown.
// Questions are tagged from this file, so a tag can only ever be a real skill of the question's level.

export interface Subskill { id: string; name: string }
export interface CoreSkill { id: string; name: string; domain: string; definition: string; subskills: Subskill[] }
export interface LevelSkills { primary: string[]; supporting: string[] }

export const CORE_SKILLS: readonly CoreSkill[] = [
 {
  "id": "SK01",
  "name": "One-to-One Correspondence",
  "domain": "Pre-number",
  "definition": "Matching each item in one set to exactly one item in another.",
  "subskills": [
   {
    "id": "SK01.01",
    "name": "Match one object to one object"
   },
   {
    "id": "SK01.02",
    "name": "Match objects across two groups"
   },
   {
    "id": "SK01.03",
    "name": "Maintain one-to-one correspondence while counting"
   },
   {
    "id": "SK01.04",
    "name": "Identify unmatched objects"
   }
  ]
 },
 {
  "id": "SK02",
  "name": "Classification",
  "domain": "Pre-number",
  "definition": "Grouping objects by shared property and identifying non-members.",
  "subskills": [
   {
    "id": "SK02.01",
    "name": "Classify by one property"
   },
   {
    "id": "SK02.02",
    "name": "Identify common property"
   },
   {
    "id": "SK02.03",
    "name": "Identify odd object"
   },
   {
    "id": "SK02.04",
    "name": "Classify by multiple properties"
   },
   {
    "id": "SK02.05",
    "name": "Flexible reclassification"
   }
  ]
 },
 {
  "id": "SK03",
  "name": "Seriation & Ordering",
  "domain": "Pre-number",
  "definition": "Arranging objects or numbers by a quantitative attribute.",
  "subskills": [
   {
    "id": "SK03.01",
    "name": "Arrange three objects by size"
   },
   {
    "id": "SK03.02",
    "name": "Arrange objects by length"
   },
   {
    "id": "SK03.03",
    "name": "Use comparative relationships"
   },
   {
    "id": "SK03.04",
    "name": "Apply transitivity"
   },
   {
    "id": "SK03.05",
    "name": "Order numerals"
   },
   {
    "id": "SK03.06",
    "name": "Order numbers ascending"
   },
   {
    "id": "SK03.07",
    "name": "Order numbers descending"
   }
  ]
 },
 {
  "id": "SK04",
  "name": "Same/Different & Attribute Recognition",
  "domain": "Pre-number",
  "definition": "Identifying visual and shape attributes of objects.",
  "subskills": [
   {
    "id": "SK04.01",
    "name": "Perceptual same/different"
   },
   {
    "id": "SK04.02",
    "name": "Identify visual attributes"
   },
   {
    "id": "SK04.03",
    "name": "Identify shape attributes"
   },
   {
    "id": "SK04.04",
    "name": "Identify object differences"
   }
  ]
 },
 {
  "id": "SK05",
  "name": "Counting & Counting Sequence",
  "domain": "Number Sense",
  "definition": "Producing number words in order to enumerate.",
  "subskills": [
   {
    "id": "SK05.01",
    "name": "Rote counting to 10"
   },
   {
    "id": "SK05.02",
    "name": "Count objects 1-3"
   },
   {
    "id": "SK05.03",
    "name": "Count to 5"
   },
   {
    "id": "SK05.04",
    "name": "Count to 10"
   },
   {
    "id": "SK05.05",
    "name": "Count to 20"
   },
   {
    "id": "SK05.06",
    "name": "Count to 50"
   },
   {
    "id": "SK05.07",
    "name": "Count to 100"
   },
   {
    "id": "SK05.08",
    "name": "Count forward from a given number"
   },
   {
    "id": "SK05.09",
    "name": "Count backward"
   }
  ]
 },
 {
  "id": "SK06",
  "name": "Cardinality",
  "domain": "Number Sense",
  "definition": "The last number said in a count tells how many.",
  "subskills": [
   {
    "id": "SK06.01",
    "name": "Understand last number counted as total"
   },
   {
    "id": "SK06.02",
    "name": "Count small sets"
   },
   {
    "id": "SK06.03",
    "name": "Count and tell how many"
   },
   {
    "id": "SK06.04",
    "name": "Relate quantity to numeral"
   }
  ]
 },
 {
  "id": "SK07",
  "name": "Subitizing",
  "domain": "Number Sense",
  "definition": "Recognising small quantities without counting.",
  "subskills": [
   {
    "id": "SK07.01",
    "name": "Perceptual subitizing"
   },
   {
    "id": "SK07.02",
    "name": "Recognize small quantity without counting"
   },
   {
    "id": "SK07.03",
    "name": "Conceptual subitizing"
   },
   {
    "id": "SK07.04",
    "name": "Compose quantity from subgroups"
   }
  ]
 },
 {
  "id": "SK08",
  "name": "Quantity & Numeral Representation",
  "domain": "Number Sense",
  "definition": "Showing numerals, reading, writing, matching to quantity.",
  "subskills": [
   {
    "id": "SK08.01",
    "name": "Recognize numerals 1-10"
   },
   {
    "id": "SK08.02",
    "name": "Match numeral to quantity"
   },
   {
    "id": "SK08.03",
    "name": "Represent quantity with objects"
   },
   {
    "id": "SK08.04",
    "name": "Read numerals"
   },
   {
    "id": "SK08.05",
    "name": "Write numerals"
   },
   {
    "id": "SK08.06",
    "name": "Read/write numbers to 99"
   },
   {
    "id": "SK08.07",
    "name": "Read/write three-digit numbers"
   },
   {
    "id": "SK08.08",
    "name": "Read/write four-digit numbers"
   },
   {
    "id": "SK08.09",
    "name": "Zero as \"none\""
   }
  ]
 },
 {
  "id": "SK09",
  "name": "Number Comparison",
  "domain": "Number Sense",
  "definition": "Determining which of two numbers is greater, lesser, or equal.",
  "subskills": [
   {
    "id": "SK09.01",
    "name": "Compare quantities"
   },
   {
    "id": "SK09.02",
    "name": "More/less/equal"
   },
   {
    "id": "SK09.03",
    "name": "Compare numerals using objects"
   },
   {
    "id": "SK09.04",
    "name": "Abstract numeral comparison"
   },
   {
    "id": "SK09.05",
    "name": "Compare close numbers"
   },
   {
    "id": "SK09.06",
    "name": "Compare two-digit numbers"
   },
   {
    "id": "SK09.07",
    "name": "Compare three-digit numbers"
   }
  ]
 },
 {
  "id": "SK10",
  "name": "Number Sequencing & Number Line",
  "domain": "Number Sense",
  "definition": "Locating numbers on a sequence or number line.",
  "subskills": [
   {
    "id": "SK10.01",
    "name": "Numeral sequencing"
   },
   {
    "id": "SK10.02",
    "name": "Before"
   },
   {
    "id": "SK10.03",
    "name": "After"
   },
   {
    "id": "SK10.04",
    "name": "Between"
   },
   {
    "id": "SK10.05",
    "name": "Missing number"
   },
   {
    "id": "SK10.06",
    "name": "Ordinal position"
   },
   {
    "id": "SK10.07",
    "name": "Informal number line 0-20"
   },
   {
    "id": "SK10.08",
    "name": "Number line 0-100"
   }
  ]
 },
 {
  "id": "SK11",
  "name": "Place Value & Base-Ten Structure",
  "domain": "Number Sense",
  "definition": "Understanding that the position of a digit determines its value.",
  "subskills": [
   {
    "id": "SK11.01",
    "name": "Understand groups of ten"
   },
   {
    "id": "SK11.02",
    "name": "Tens and ones"
   },
   {
    "id": "SK11.03",
    "name": "Tens as bundles"
   },
   {
    "id": "SK11.04",
    "name": "Zero as placeholder"
   },
   {
    "id": "SK11.05",
    "name": "Two-digit place value"
   },
   {
    "id": "SK11.06",
    "name": "Three-digit place value"
   },
   {
    "id": "SK11.07",
    "name": "Expanded form"
   },
   {
    "id": "SK11.08",
    "name": "Four-digit place value"
   },
   {
    "id": "SK11.09",
    "name": "Five-digit place value"
   },
   {
    "id": "SK11.10",
    "name": "Face value"
   }
  ]
 },
 {
  "id": "SK12",
  "name": "Number Composition & Decomposition",
  "domain": "Number Sense",
  "definition": "Breaking a number into parts and recombining them.",
  "subskills": [
   {
    "id": "SK12.01",
    "name": "Compose quantities"
   },
   {
    "id": "SK12.02",
    "name": "Decompose quantities"
   },
   {
    "id": "SK12.03",
    "name": "Flexible two-digit decomposition"
   },
   {
    "id": "SK12.04",
    "name": "Flexible three-digit decomposition"
   },
   {
    "id": "SK12.05",
    "name": "Expanded form (decomposition)"
   },
   {
    "id": "SK12.06",
    "name": "Regroup quantities"
   }
  ]
 },
 {
  "id": "SK13",
  "name": "Addition",
  "domain": "Number Operations",
  "definition": "Combining to find the total.",
  "subskills": [
   {
    "id": "SK13.01",
    "name": "Combine sets"
   },
   {
    "id": "SK13.02",
    "name": "Concrete addition"
   },
   {
    "id": "SK13.03",
    "name": "Single-digit addition"
   },
   {
    "id": "SK13.04",
    "name": "Addition within 20"
   },
   {
    "id": "SK13.05",
    "name": "Addition within 30"
   },
   {
    "id": "SK13.06",
    "name": "Two-digit addition"
   },
   {
    "id": "SK13.07",
    "name": "Addition with regrouping"
   },
   {
    "id": "SK13.08",
    "name": "Three-digit addition"
   },
   {
    "id": "SK13.09",
    "name": "Multi-digit addition"
   },
   {
    "id": "SK13.10",
    "name": "Addition word problems"
   }
  ]
 },
 {
  "id": "SK14",
  "name": "Subtraction",
  "domain": "Number Operations",
  "definition": "Taking away or finding the difference.",
  "subskills": [
   {
    "id": "SK14.01",
    "name": "Take away"
   },
   {
    "id": "SK14.02",
    "name": "Concrete subtraction"
   },
   {
    "id": "SK14.03",
    "name": "Single-digit subtraction"
   },
   {
    "id": "SK14.04",
    "name": "Subtraction within 20"
   },
   {
    "id": "SK14.05",
    "name": "Subtraction within 30"
   },
   {
    "id": "SK14.06",
    "name": "Two-digit subtraction"
   },
   {
    "id": "SK14.07",
    "name": "Subtraction with regrouping"
   },
   {
    "id": "SK14.08",
    "name": "Three-digit subtraction"
   },
   {
    "id": "SK14.09",
    "name": "Multi-digit subtraction"
   },
   {
    "id": "SK14.10",
    "name": "Subtraction word problems"
   }
  ]
 },
 {
  "id": "SK15",
  "name": "Multiplication",
  "domain": "Number Operations",
  "definition": "Repeated addition / scaling.",
  "subskills": [
   {
    "id": "SK15.01",
    "name": "Equal groups"
   },
   {
    "id": "SK15.02",
    "name": "Repeated addition"
   },
   {
    "id": "SK15.03",
    "name": "Skip-count connection"
   },
   {
    "id": "SK15.04",
    "name": "Multiplication facts 2,3,4,5,10"
   },
   {
    "id": "SK15.05",
    "name": "Tables 2-10"
   },
   {
    "id": "SK15.06",
    "name": "Multi-digit multiplication"
   },
   {
    "id": "SK15.07",
    "name": "Multiplication word problems"
   },
   {
    "id": "SK15.08",
    "name": "Factors and multiples"
   }
  ]
 },
 {
  "id": "SK16",
  "name": "Division",
  "domain": "Number Operations",
  "definition": "Splitting into equal shares or groups.",
  "subskills": [
   {
    "id": "SK16.01",
    "name": "Equal sharing"
   },
   {
    "id": "SK16.02",
    "name": "Equal grouping"
   },
   {
    "id": "SK16.03",
    "name": "Division facts"
   },
   {
    "id": "SK16.04",
    "name": "Relation to multiplication"
   },
   {
    "id": "SK16.05",
    "name": "Division procedures"
   },
   {
    "id": "SK16.06",
    "name": "Long division"
   },
   {
    "id": "SK16.07",
    "name": "Division word problems"
   }
  ]
 },
 {
  "id": "SK17",
  "name": "Fractions",
  "domain": "Fractions",
  "definition": "Equal parts of a whole; notation and equivalence.",
  "subskills": [
   {
    "id": "SK17.01",
    "name": "Equal parts"
   },
   {
    "id": "SK17.02",
    "name": "Half"
   },
   {
    "id": "SK17.03",
    "name": "Quarter"
   },
   {
    "id": "SK17.04",
    "name": "Fraction notation"
   },
   {
    "id": "SK17.05",
    "name": "Equivalent fractions"
   },
   {
    "id": "SK17.06",
    "name": "Decimal notation (tenths and hundredths)"
   }
  ]
 },
 {
  "id": "SK18",
  "name": "Patterns & Generalization",
  "domain": "Patterns",
  "definition": "Identifying, extending, and generalizing rules in sequences.",
  "subskills": [
   {
    "id": "SK18.01",
    "name": "Identify repeating pattern"
   },
   {
    "id": "SK18.02",
    "name": "Extend pattern"
   },
   {
    "id": "SK18.03",
    "name": "Copy pattern"
   },
   {
    "id": "SK18.04",
    "name": "Two-item pattern"
   },
   {
    "id": "SK18.05",
    "name": "Three-item pattern"
   },
   {
    "id": "SK18.06",
    "name": "Number pattern"
   },
   {
    "id": "SK18.07",
    "name": "Skip-count pattern"
   },
   {
    "id": "SK18.08",
    "name": "Identify pattern rule"
   },
   {
    "id": "SK18.09",
    "name": "Generalize pattern"
   },
   {
    "id": "SK18.10",
    "name": "Advanced number pattern"
   }
  ]
 },
 {
  "id": "SK19",
  "name": "Shapes & Spatial Reasoning",
  "domain": "Shapes & Spatial",
  "definition": "Recognising, comparing, composing, and reasoning about shapes.",
  "subskills": [
   {
    "id": "SK19.01",
    "name": "Shape matching"
   },
   {
    "id": "SK19.02",
    "name": "Identify basic shapes"
   },
   {
    "id": "SK19.03",
    "name": "Identify shape properties"
   },
   {
    "id": "SK19.04",
    "name": "Compose shapes"
   },
   {
    "id": "SK19.05",
    "name": "Decompose shapes"
   },
   {
    "id": "SK19.06",
    "name": "Identify 2D shapes"
   },
   {
    "id": "SK19.07",
    "name": "Identify 3D shapes"
   },
   {
    "id": "SK19.08",
    "name": "Spatial vocabulary"
   },
   {
    "id": "SK19.09",
    "name": "Relate 2D faces to 3D solids"
   },
   {
    "id": "SK19.10",
    "name": "Nets"
   },
   {
    "id": "SK19.11",
    "name": "Perspective"
   },
   {
    "id": "SK19.12",
    "name": "Angles and turns"
   },
   {
    "id": "SK19.13",
    "name": "Symmetry"
   },
   {
    "id": "SK19.14",
    "name": "Reflection"
   }
  ]
 },
 {
  "id": "SK20",
  "name": "Measurement",
  "domain": "Measurement",
  "definition": "Comparing and quantifying length, capacity, area, perimeter.",
  "subskills": [
   {
    "id": "SK20.01",
    "name": "Compare length"
   },
   {
    "id": "SK20.02",
    "name": "Compare size"
   },
   {
    "id": "SK20.03",
    "name": "Compare capacity"
   },
   {
    "id": "SK20.04",
    "name": "Estimate length"
   },
   {
    "id": "SK20.05",
    "name": "Estimate capacity"
   },
   {
    "id": "SK20.06",
    "name": "Use non-standard units"
   },
   {
    "id": "SK20.07",
    "name": "Use uniform units"
   },
   {
    "id": "SK20.08",
    "name": "Standard measurement units"
   },
   {
    "id": "SK20.09",
    "name": "Unit conversion"
   },
   {
    "id": "SK20.10",
    "name": "Applied measurement"
   },
   {
    "id": "SK20.11",
    "name": "Perimeter"
   },
   {
    "id": "SK20.12",
    "name": "Area"
   }
  ]
 },
 {
  "id": "SK21",
  "name": "Time & Calendar",
  "domain": "Calendar & Time",
  "definition": "Reading clocks, calendars, computing elapsed time.",
  "subskills": [
   {
    "id": "SK21.01",
    "name": "Day/night concepts"
   },
   {
    "id": "SK21.02",
    "name": "Calendar structure"
   },
   {
    "id": "SK21.03",
    "name": "Days/weeks/months"
   },
   {
    "id": "SK21.04",
    "name": "Read calendar"
   },
   {
    "id": "SK21.05",
    "name": "Tell time to hour"
   },
   {
    "id": "SK21.06",
    "name": "Tell time to half-hour"
   },
   {
    "id": "SK21.07",
    "name": "Calculate elapsed time"
   },
   {
    "id": "SK21.08",
    "name": "Advanced time problems"
   }
  ]
 },
 {
  "id": "SK22",
  "name": "Money",
  "domain": "Money",
  "definition": "Recognising currency and computing amounts.",
  "subskills": [
   {
    "id": "SK22.01",
    "name": "Recognize currency"
   },
   {
    "id": "SK22.02",
    "name": "Match currency to value"
   },
   {
    "id": "SK22.03",
    "name": "Combine amounts"
   },
   {
    "id": "SK22.04",
    "name": "Calculate total cost"
   },
   {
    "id": "SK22.05",
    "name": "Calculate change"
   },
   {
    "id": "SK22.06",
    "name": "Multi-step money problems"
   }
  ]
 },
 {
  "id": "SK23",
  "name": "Data Handling",
  "domain": "Data",
  "definition": "Sorting, tallying, reading and interpreting data displays.",
  "subskills": [
   {
    "id": "SK23.01",
    "name": "Sort data"
   },
   {
    "id": "SK23.02",
    "name": "Classify data"
   },
   {
    "id": "SK23.03",
    "name": "Tally"
   },
   {
    "id": "SK23.04",
    "name": "Count categories"
   },
   {
    "id": "SK23.05",
    "name": "Read pictograph"
   },
   {
    "id": "SK23.06",
    "name": "Read bar graph"
   },
   {
    "id": "SK23.07",
    "name": "Compare data"
   },
   {
    "id": "SK23.08",
    "name": "Interpret data"
   }
  ]
 },
 {
  "id": "SK24",
  "name": "Mathematical Reasoning & Problem Solving",
  "domain": "Cross-cutting",
  "definition": "Applying mathematics to situations across strands.",
  "subskills": [
   {
    "id": "SK24.01",
    "name": "Identify relevant information"
   },
   {
    "id": "SK24.02",
    "name": "Choose an operation"
   },
   {
    "id": "SK24.03",
    "name": "Represent a problem"
   },
   {
    "id": "SK24.04",
    "name": "Explain reasoning"
   },
   {
    "id": "SK24.05",
    "name": "Check an answer"
   },
   {
    "id": "SK24.06",
    "name": "Apply mathematics to daily life"
   },
   {
    "id": "SK24.07",
    "name": "Solve multi-step problems"
   }
  ]
 }
];

/** Level number -> the skills it mainly teaches (primary) and leans on (supporting). */
export const LEVEL_SKILLS: Readonly<Record<number, LevelSkills>> = {
  1: { primary: ["SK01"], supporting: ["SK06"] },
  2: { primary: ["SK02"], supporting: ["SK04"] },
  3: { primary: ["SK04"], supporting: ["SK02"] },
  4: { primary: ["SK05"], supporting: ["SK10"] },
  5: { primary: ["SK05", "SK06"], supporting: ["SK01"] },
  6: { primary: ["SK19"], supporting: ["SK04"] },
  7: { primary: ["SK07"], supporting: ["SK06"] },
  8: { primary: ["SK03"], supporting: ["SK04"] },
  9: { primary: ["SK09"], supporting: ["SK01", "SK06"] },
  10: { primary: ["SK03"], supporting: ["SK09"] },
  11: { primary: ["SK02"], supporting: ["SK04"] },
  12: { primary: ["SK05", "SK06"], supporting: ["SK01"] },
  13: { primary: ["SK05"], supporting: ["SK06"] },
  14: { primary: ["SK19"], supporting: ["SK04"] },
  15: { primary: ["SK18"], supporting: ["SK04"] },
  16: { primary: ["SK20"], supporting: ["SK09"] },
  17: { primary: ["SK07"], supporting: ["SK06", "SK12"] },
  18: { primary: ["SK19"], supporting: ["SK12"] },
  19: { primary: ["SK08"], supporting: ["SK05"] },
  20: { primary: ["SK08", "SK06"], supporting: ["SK05"] },
  21: { primary: ["SK09"], supporting: ["SK08"] },
  22: { primary: ["SK03"], supporting: ["SK09"] },
  23: { primary: ["SK02"], supporting: ["SK04", "SK24"] },
  24: { primary: ["SK10"], supporting: ["SK05", "SK08"] },
  25: { primary: ["SK20"], supporting: ["SK09"] },
  26: { primary: ["SK18"], supporting: ["SK04"] },
  27: { primary: ["SK19"], supporting: ["SK12"] },
  28: { primary: ["SK05"], supporting: ["SK10"] },
  29: { primary: ["SK06"], supporting: ["SK05"] },
  30: { primary: ["SK08"], supporting: ["SK05"] },
  31: { primary: ["SK13"], supporting: ["SK06"] },
  32: { primary: ["SK14"], supporting: ["SK06"] },
  33: { primary: ["SK15"], supporting: ["SK05"] },
  34: { primary: ["SK16"], supporting: ["SK01"] },
  35: { primary: ["SK18"], supporting: ["SK04"] },
  36: { primary: ["SK18"], supporting: ["SK24"] },
  37: { primary: ["SK19"], supporting: ["SK04"] },
  38: { primary: ["SK19"], supporting: ["SK04"] },
  39: { primary: ["SK19"], supporting: ["SK04"] },
  40: { primary: ["SK20"], supporting: ["SK09"] },
  41: { primary: ["SK21"], supporting: ["SK05"] },
  42: { primary: ["SK24"], supporting: ["SK08"] },
  43: { primary: ["SK08"], supporting: ["SK05", "SK11"] },
  44: { primary: ["SK10"], supporting: ["SK05"] },
  45: { primary: ["SK22"], supporting: ["SK08"] },
  46: { primary: ["SK19"], supporting: ["SK24"] },
  47: { primary: ["SK09"], supporting: ["SK08", "SK10"] },
  48: { primary: ["SK09"], supporting: ["SK11"] },
  49: { primary: ["SK05", "SK06"], supporting: ["SK01"] },
  50: { primary: ["SK08"], supporting: ["SK05", "SK11"] },
  51: { primary: ["SK11"], supporting: ["SK12"] },
  52: { primary: ["SK13"], supporting: ["SK05", "SK06", "SK12"] },
  53: { primary: ["SK14"], supporting: ["SK05", "SK06"] },
  54: { primary: ["SK19"], supporting: ["SK04"] },
  55: { primary: ["SK19"], supporting: ["SK04"] },
  56: { primary: ["SK20"], supporting: ["SK24"] },
  57: { primary: ["SK20"], supporting: ["SK24"] },
  58: { primary: ["SK18"], supporting: ["SK04"] },
  59: { primary: ["SK10"], supporting: ["SK09"] },
  60: { primary: ["SK19"], supporting: ["SK12"] },
  61: { primary: ["SK08"], supporting: ["SK11"] },
  62: { primary: ["SK11"], supporting: ["SK12"] },
  63: { primary: ["SK12"], supporting: ["SK11"] },
  64: { primary: ["SK13", "SK11"], supporting: ["SK12"] },
  65: { primary: ["SK14", "SK11"], supporting: ["SK12"] },
  66: { primary: ["SK15"], supporting: ["SK13", "SK18"] },
  67: { primary: ["SK16"], supporting: ["SK01", "SK06"] },
  68: { primary: ["SK15"], supporting: ["SK18"] },
  69: { primary: ["SK17"], supporting: ["SK19"] },
  70: { primary: ["SK20"], supporting: ["SK24"] },
  71: { primary: ["SK19"], supporting: ["SK02"] },
  72: { primary: ["SK21"], supporting: ["SK10"] },
  73: { primary: ["SK23"], supporting: ["SK02", "SK05"] },
  74: { primary: ["SK18"], supporting: ["SK10"] },
  75: { primary: ["SK11"], supporting: ["SK08"] },
  76: { primary: ["SK10"], supporting: ["SK09", "SK11"] },
  77: { primary: ["SK18", "SK15"], supporting: ["SK05"] },
  78: { primary: ["SK11"], supporting: ["SK12"] },
  79: { primary: ["SK12"], supporting: ["SK11"] },
  80: { primary: ["SK09", "SK03"], supporting: ["SK11"] },
  81: { primary: ["SK08"], supporting: ["SK11"] },
  82: { primary: ["SK13", "SK14"], supporting: ["SK11", "SK12"] },
  83: { primary: ["SK15"], supporting: ["SK18"] },
  84: { primary: ["SK16"], supporting: ["SK15"] },
  85: { primary: ["SK20"], supporting: ["SK24"] },
  86: { primary: ["SK19"], supporting: ["SK04"] },
  87: { primary: ["SK21"], supporting: ["SK10"] },
  88: { primary: ["SK22"], supporting: ["SK13", "SK14"] },
  89: { primary: ["SK17"], supporting: ["SK12"] },
  90: { primary: ["SK18"], supporting: ["SK24"] },
  91: { primary: ["SK23"], supporting: ["SK05", "SK09"] },
  92: { primary: ["SK11"], supporting: ["SK12"] },
  93: { primary: ["SK13", "SK14", "SK11"], supporting: ["SK12"] },
  94: { primary: ["SK24", "SK13", "SK14"], supporting: ["SK11", "SK12"] },
  95: { primary: ["SK15"], supporting: ["SK11", "SK12"] },
  96: { primary: ["SK16"], supporting: ["SK15", "SK11"] },
  97: { primary: ["SK17"], supporting: ["SK12"] },
  98: { primary: ["SK20"], supporting: ["SK12"] },
  99: { primary: ["SK20", "SK24"], supporting: ["SK13", "SK14"] },
  100: { primary: ["SK19"], supporting: ["SK12", "SK24"] },
  101: { primary: ["SK21"], supporting: ["SK13", "SK14"] },
  102: { primary: ["SK22", "SK24"], supporting: ["SK13", "SK14"] },
  103: { primary: ["SK18"], supporting: ["SK10", "SK24"] },
  104: { primary: ["SK23"], supporting: ["SK09", "SK24"] },
  105: { primary: ["SK15", "SK18"], supporting: ["SK16"] },
  106: { primary: ["SK08", "SK17"], supporting: ["SK11", "SK12"] },
  107: { primary: ["SK19"], supporting: ["SK10"] },
  108: { primary: ["SK19"], supporting: ["SK18"] },
  109: { primary: ["SK20"], supporting: ["SK19", "SK13"] },
};

const SKILL_BY_ID = new Map(CORE_SKILLS.map(s => [s.id, s]));

export function getSkill(id: string): CoreSkill | undefined { return SKILL_BY_ID.get(id); }

export interface LevelTags {
  levelNumber: number;
  primarySkills: CoreSkill[];
  supportingSkills: CoreSkill[];
  /** Every subskill a question of this level may be tagged with: those of its primary and supporting skills. */
  subskills: (Subskill & { skillId: string })[];
}

/** The skills of a level, with the subskills a question may be tagged with. Undefined for a level that does not exist. */
export function tagsForLevel(levelNumber: number): LevelTags | undefined {
  const m = LEVEL_SKILLS[levelNumber];
  if (!m) return undefined;
  const pick = (ids: string[]) => ids.map(id => SKILL_BY_ID.get(id)).filter((s): s is CoreSkill => s !== undefined);
  const primarySkills = pick(m.primary), supportingSkills = pick(m.supporting);
  return {
    levelNumber, primarySkills, supportingSkills,
    subskills: [...primarySkills, ...supportingSkills].flatMap(s => s.subskills.map(x => ({ ...x, skillId: s.id }))),
  };
}

