import conceptMap from './conceptDictionary.json';
import { aiClassifyConcept } from './conceptClassifier';

export interface BlueprintQuestion {
  question: string;
  answer: string;
  topic: string;
  aiGenerated: boolean;
  needsReview?: boolean;
  answerMode?: 'text' | 'dropdown';
  options?: string[];
  remediation?: string;
  subQuestions?: {
    prompt: string;
    answer: string;
  }[];
}

export function getHumanReadableRemediation(concept: string, questionText: string = ''): string {
  const c = (concept || '').toLowerCase();

  if (c.includes('tally') || c.includes('tallies')) {
    return 'Count each group of 5 tally marks (||||/) as 5, then add single vertical tally marks (|) to find the total count.';
  }
  if (c.includes('finger') || c.includes('fruit') || c.toLowerCase().includes('matchfingerstofruits')) {
    return 'Match each finger name (Thumb, Index, Middle, Ring, Little) to its corresponding item in the options list.';
  }
  if (c.includes('add and match') || c.includes('addition and match')) {
    return 'Calculate the sum of the numbers and select the matching answer option.';
  }
  if (c.includes('addition') || c.includes('add')) {
    return 'Line up numbers vertically by place value (ones, tens) and add digits starting from the right. Carry over when sum is 10 or more.';
  }
  if (c.includes('subtraction') || c.includes('subtract') || c.includes('minus')) {
    return 'Line up numbers by place value and subtract right-to-left. Borrow 1 ten from the left if top digit is smaller than bottom digit.';
  }
  if (c.includes('multiplication') || c.includes('multiply') || c.includes('times')) {
    return 'Multiply numbers using basic multiplication facts. For multi-digit numbers, multiply by place values and add products.';
  }
  if (c.includes('division') || c.includes('divide')) {
    return 'Divide into equal groups or calculate how many times the divisor fits into the dividend.';
  }
  if (c.includes('algebra')) {
    return 'Solve linear equations by performing inverse operations to isolate the variable x on one side.';
  }
  if (c.includes('fraction')) {
    return 'Remember: the top number (numerator) represents shaded parts, and bottom number (denominator) represents total equal parts.';
  }
  if (c.includes('factor')) {
    return 'Factors are whole numbers that divide evenly into a number without leaving a remainder.';
  }
  if (c.includes('multiple')) {
    return 'Multiples of a number are produced by multiplying it by whole numbers (1, 2, 3...).';
  }
  if (c.includes('place value')) {
    return 'Identify the position of each digit: Hundreds, Tens, and Ones/Units.';
  }
  if (c.includes('odd one out') || c.includes('does not belong') || c.includes('classification')) {
    return 'Look at the categories of the items (fruits, animals, stationery, vehicles). Choose the item that does not belong to the same category as the others.';
  }
  if (c.includes('geometry') || c.includes('shape') || c.includes('angle')) {
    if (/\b(angle|angles|degree|degrees|protractor|90|acute|obtuse|right)\b/i.test(questionText)) {
      return 'An angle measures the turn between two lines meeting at a point: Right angle (90°), Acute angle (< 90°), Obtuse angle (> 90°), Straight angle (180°).';
    }
    return 'Observe the number of sides, corners, and properties of geometric shapes.';
  }
  if (c.includes('time') || c.includes('clock')) {
    return 'Look at the short hour hand first for the hour, then the long minute hand for minutes (12 = 00 mins, 6 = 30 mins).';
  }
  if (c.includes('ordinal')) {
    return 'Ordinal numbers show position in a series (1st = first, 2nd = second, 3rd = third...).';
  }
  if (c.includes('decimal')) {
    return 'The decimal point separates whole numbers on the left from tenths and hundredths on the right.';
  }
  if (c.includes('percent')) {
    return 'Percentage means parts out of 100. Multiply the total by the fraction (percent / 100).';
  }
  if (c.includes('ratio')) {
    return 'A ratio compares two quantities by division (written as a:b). Simplify by dividing both by their common factor.';
  }
  if (c.includes('statistic') || c.includes('mean') || c.includes('average')) {
    return 'To find the mean average, add all values together and divide the total by the number of items.';
  }
  if (c.includes('probabil')) {
    return 'Probability measures how likely an event is to happen: (Favorable Outcomes / Total Possible Outcomes).';
  }
  if (c.includes('integer')) {
    return 'Integers include positive numbers, zero, and negative numbers. Use the number line to add and subtract.';
  }
  if (c.includes('ordering')) {
    return 'Order numbers by comparing place values from left to right (smallest to largest for ascending, largest to smallest for descending).';
  }
  if (c.includes('comparison') || c.includes('compare')) {
    return 'Compare quantities using symbols: > (greater than), < (less than), and = (equal to).';
  }
  if (c.includes("area")) {
    return "Area of square = side × side; Area of rectangle = length × breadth.";
  }
  if (c.includes("visual")) {
    return "Observe sides, corners, and properties of geometric shapes.";
  }


  return `Review the basic principles for "${concept || 'this topic'}". Break down the question step-by-step with your teacher.`;
}

// ─── Concept Dictionary ────────────────────────────────────────────────────────
// Loaded from conceptDictionary.json — add new concepts there, not here.
export const CONCEPT_MAP: Record<string, string[]> = conceptMap as Record<string, string[]>;

// ─── DROPDOWN CONCEPTS ────────────────────────────────────────────────────────
// Concepts where the answer is best selected from a list, not typed freely.
const DROPDOWN_CONCEPTS = new Set([
  'fractions',
  'complete the whole',
  'measurement',
  'unit conversion',
  'percentages',
  'geometry',
  'time',
  'probability',
  'match fingers to fruits',
  'matchfingerstofruits',
  'add and match',
  'addandmatch',
  'match the tallies',
  'matchthetallies',
  'tally marks',
  'tally',
]);

/**
 * Returns 'dropdown' for concepts with discrete answer choices (e.g. Fractions,
 * Measurement units), and 'text' for everything else.
 */
export function getAnswerMode(concept: string): 'text' | 'dropdown' {
  return DROPDOWN_CONCEPTS.has((concept || '').toLowerCase()) ? 'dropdown' : 'text';
}

/**
 * Strip answer-option markers and "Choose:" prompts from scanned question text
 * so stored questions are clean and don't trigger dropdown rendering by accident.
 */
export function sanitizeQuestionText(text: string): string {
  return (text || '')
    .replace(/☑|☐/g, '')
    .replace(/\bChoose:\s*/gi, '')
    .replace(/\(Choose:[^)]*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function normalizeQuestionText(text: string): string {
  return (text || '')
    .replace(/[\s—–-]*item\s*\d+/gi, '')
    .replace(/[\s—–-]*question\s*\d+/gi, '')
    .trim()
    .toLowerCase();
}

function getFactors(n: number): number[] {
  const res: number[] = [];
  for (let i = 1; i <= n; i++) if (n % i === 0) res.push(i);
  return res;
}

function getMultiples(n: number, count: number): number[] {
  const res: number[] = [];
  for (let i = 1; i <= count; i++) res.push(n * i);
  return res;
}

// ─── detectConcept ─────────────────────────────────────────────────────────────
/**
 * Unified concept detection workflow:
 *  1. Keyword detection from CONCEPT_MAP / registry
 *  2. Caller's hintConcept fallback
 *  3. AI / NLP Concept Classifier fallback (`aiClassifyConcept`)
 *  4. Default to 'General'
 */
export function detectConcept(questionText: string, hintConcept: string = ''): string {
  const combinedText = ((hintConcept || '') + ' ' + (questionText || '')).toLowerCase();

  // 1. Keyword detection from CONCEPT_MAP against hintConcept and questionText
  const allEntries: Array<{ concept: string; keyword: string }> = [];
  for (const concept in CONCEPT_MAP) {
    const entry = CONCEPT_MAP[concept];
    const keywords: string[] = Array.isArray(entry) ? entry : ((entry as any)?.keywords || []);
    for (const keyword of keywords) {
      if (keyword && keyword.trim()) {
        allEntries.push({ concept, keyword: keyword.toLowerCase().trim() });
      }
    }
  }
  allEntries.sort((a, b) => b.keyword.length - a.keyword.length);

  for (const { concept, keyword } of allEntries) {
    if (combinedText.includes(keyword)) {
      return concept;
    }
  }

  // 2. Direct hintConcept match fallback
  if (hintConcept && hintConcept.trim() && hintConcept.toLowerCase() !== 'general') {
    const hintLow = hintConcept.toLowerCase().trim();
    for (const concept in CONCEPT_MAP) {
      if (concept.toLowerCase() === hintLow) {
        return concept;
      }
    }
    return hintConcept;
  }

  // 3. AI / NLP Classifier Fallback for new / un-mapped question text
  const classified = aiClassifyConcept(questionText);
  if (classified) {
    return classified;
  }

  // 4. Default
  return 'General';
}

/**
 * Multi-concept detection workflow:
 * Extracts ALL concepts present in compound/multi-concept questions (e.g. Add and Subtract Match).
 */
export function detectMultiConcepts(questionText: string, hintConcept: string = ''): string[] {
  const normQ = normalizeQuestionText(questionText);
  const q = normQ.toLowerCase();
  const detected = new Set<string>();

  const allEntries: Array<{ concept: string; keyword: string }> = [];
  for (const concept in CONCEPT_MAP) {
    const entry = CONCEPT_MAP[concept];
    const keywords: string[] = Array.isArray(entry) ? entry : ((entry as any)?.keywords || []);
    for (const keyword of keywords) {
      if (keyword && keyword.trim()) {
        allEntries.push({ concept, keyword: keyword.toLowerCase().trim() });
      }
    }
  }
  allEntries.sort((a, b) => b.keyword.length - a.keyword.length);

  for (const { concept, keyword } of allEntries) {
    if (q.includes(keyword)) {
      detected.add(concept);
    }
  }

  if (hintConcept) {
    const hintLow = hintConcept.toLowerCase();
    for (const concept in CONCEPT_MAP) {
      if (concept.toLowerCase() === hintLow) {
        detected.add(concept);
      }
    }
  }

  if (detected.size === 0) {
    const classified = aiClassifyConcept(questionText);
    if (classified) detected.add(classified);
  }

  if (detected.size === 0) {
    detected.add('General');
  }

  return Array.from(detected);
}

// ─── CONCEPT GENERATOR DEFINITIONS ─────────────────────────────────────────────
export type ConceptGenerator = (
  variantIndex: number,
  originalQ?: string,
  originalAnswer?: string
) => BlueprintQuestion;

const generateFractions: ConceptGenerator = (v) => {
  const presets = [
    { q: '1 out of 2 equal parts shaded (Choose: 1/2, 1/3, or 1/4)', ans: '1/2' },
    { q: '3 out of 4 equal parts shaded (Choose: 1/4, 2/4, or 3/4)', ans: '3/4' },
    { q: '2 out of 3 equal parts shaded (Choose: 1/3, 2/3, or 3/3)', ans: '2/3' },
    { q: '1 out of 4 equal parts shaded (Choose: 1/4, 2/4, or 3/4)', ans: '1/4' },
    { q: '1 out of 3 equal parts shaded (Choose: 1/3, 2/3, or 3/3)', ans: '1/3' },
  ];

  // Use v to pick different blocks of 5 each time
  const offset = (v * 5) % presets.length;
  const set = presets.slice(offset, offset + 5);

  return {
    question: "Give the answer for what fraction of the shape is shaded:",
    subQuestions: set.map(p => ({ prompt: p.q, answer: p.ans })),
    topic: "Fractions",
    answer: "",
    aiGenerated: false,
    remediation: "Numerator = shaded parts, Denominator = total parts."
  };
};


const generateDirections: ConceptGenerator = (v) => {
  const presets = [
    { prompt: "North", answer: "Park" },
    { prompt: "East", answer: "Library" },
    { prompt: "South", answer: "Bus Stop" },
    { prompt: "West", answer: "Clock Tower" },
    { prompt: "North-East", answer: "Post Office" }
  ];
  const offset = (v * 5) % presets.length;
  const set = presets.slice(offset, offset + 5);

  return {
    question: "Identify the place in each direction from the School:",
    subQuestions: set,
    answer: "", // satisfy BlueprintQuestion
    topic: "Directions",
    aiGenerated: false,
    remediation: "Look at cardinal directions (N, E, S, W) relative to the School."
  };
};

const generateShortestPath: ConceptGenerator = (v) => {
  const routes = [
    { prompt: "School → Park (400m vs 700m)", answer: "North route" },
    { prompt: "Library → Bus Stop (300m vs 800m)", answer: "Direct South route" },
    { prompt: "Market → Station (500m vs 900m)", answer: "Main Road" },
    { prompt: "Home → School (250m vs 600m)", answer: "Footpath" },
    { prompt: "Playground → Hospital (350m vs 750m)", answer: "Direct path" }
  ];
  const offset = (v * 5) % routes.length;
  const set = routes.slice(offset, offset + 5);

  return {
    question: "Choose the shortest path in each case:",
    subQuestions: set,
    answer: "",
    topic: "Shortest Path",
    aiGenerated: false,
    remediation: "Compare distances and select the smaller value."
  };
};

const generateMapInterpretation: ConceptGenerator = (v) => {
  const mapQuestions = [
    { prompt: "On the city map, which building is located next to the Library?", answer: "Post Office" },
    { prompt: "On the park map, what feature is in the center of the park?", answer: "Fountain" },
    { prompt: "According to the legend on the map, what does the blue line represent?", answer: "River" },
    { prompt: "On the school layout map, where is the playground located?", answer: "Behind Main Building" },
    { prompt: "What does the triangle symbol typically represent on a map?", answer: "Temple" }
  ];
  const offset = (v * 5) % mapQuestions.length;
  const set = mapQuestions.slice(offset, offset + 5);

  return {
    question: "Answer these map interpretation questions:",
    subQuestions: set,
    answer: "",
    topic: "Map Interpretation",
    aiGenerated: false,
    remediation: "Use map symbols and legends to identify locations."
  };
};


const generateCommonFactors: ConceptGenerator = (v) => {
  const pairs = Array.from({ length: 5 }, (_, i) => {
    const a = 12 + (v * 5) + i * 2;
    const b = 18 + (v * 3) + i * 2;
    const common = getFactors(a).filter(f => getFactors(b).includes(f));
    return { prompt: `${a} & ${b}`, answer: common.join(", ") };
  });

  return {
    question: "Find the common factors for each pair:",
    subQuestions: pairs,
    answer: "",
    topic: "Common Factors",
    aiGenerated: false,
    remediation: "List factors of each number and find the overlap."
  };
}
const generateFactors: ConceptGenerator = (v) => {
  const nums = Array.from({ length: 5 }, (_, i) => 12 + v * 5 + i);
  const set = nums.map(n => ({ prompt: `${n}`, answer: getFactors(n).join(", ") }));

  return {
    question: "List the factors of each number:",
    subQuestions: set,
    answer: "",
    topic: "Factors",
    aiGenerated: false,
    remediation: "Factors are numbers that divide evenly into the given number."
  };
};

const generateCommonMultiples: ConceptGenerator = (v) => {
  const pairs = Array.from({ length: 5 }, (_, i) => {
    const a = 3 + v + i;
    const b = 5 + v + i;
    const multiplesA = getMultiples(a, 5);
    const multiplesB = getMultiples(b, 5);
    const common = multiplesA.filter(m => multiplesB.includes(m));
    return { prompt: `${a} & ${b}`, answer: common.length ? common.join(", ") : "None" };
  });

  return {
    question: "Find the common multiples (first 5) for each pair:",
    subQuestions: pairs,
    answer: "",
    topic: "Common Multiples",
    aiGenerated: false,
    remediation: "List multiples of each number and find overlaps."
  };
};

const generateMultiples: ConceptGenerator = (v) => {
  const nums = Array.from({ length: 5 }, (_, i) => 3 + v + i);
  const set = nums.map(n => ({ prompt: `${n}`, answer: getMultiples(n, 5).join(", ") }));

  return {
    question: "List the first 5 multiples of each number:",
    subQuestions: set,
    answer: "",
    topic: "Multiples",
    aiGenerated: false,
    remediation: "Multiply the number by 1, 2, 3, 4, 5."
  };
};

const generateCompleteTheWhole: ConceptGenerator = (v) => {
  const wholes = Array.from({ length: 5 }, (_, i) => {
    const shaded = (i + 1);
    const total = shaded + (v % 5) + 2;
    const rem = total - shaded;
    return { prompt: `${shaded}/${total} shaded`, answer: `${rem} parts` };
  });

  return {
    question: "How many more parts must be shaded to complete the whole?",
    subQuestions: wholes,
    answer: "",
    topic: "Fractions (Complete the Whole)",
    aiGenerated: false,
    remediation: "Subtract shaded parts from total parts."
  };
};

const generatePlaceValue: ConceptGenerator = (v, originalQ = '') => {
  const is2Digit = /\b2-digit\b|\b2digit\b|\btens-units\b|\btens\b|\bsticks-to-number\b|\btu-grid\b/i.test(originalQ);
  const nums = Array.from({ length: 5 }, (_, i) => is2Digit ? (15 + v * 3 + i * 7) : (100 + v * 7 + i * 11));
  const set = nums.map(num => {
    if (num < 100) {
      const t = Math.floor(num / 10);
      const o = num % 10;
      return { prompt: `Express ${num} in Tens and Ones:`, answer: `${t} Tens, ${o} Ones` };
    }
    const h = Math.floor(num / 100);
    const t = Math.floor((num % 100) / 10);
    const o = num % 10;
    return { prompt: `Express ${num} in HTO form:`, answer: `${h} Hundreds, ${t} Tens, ${o} Ones` };
  });

  return {
    question: "Write each number in Tens and Ones / HTO form:",
    subQuestions: set,
    answer: "",
    topic: "Place Value",
    aiGenerated: false,
    remediation: "Identify digit positions: Hundreds, Tens, Ones."
  };
};

/**
 * Underlined-digit place value practice questions — matches the paper
 * generator's exact wording ("Identify the place value of the underlined
 * digit: 7_8_4") where the digit wrapped between underscores is the one
 * being asked about. Produces 5 unique numbers, keeps the same instruction,
 * and returns the place value (digit × its place) as the answer.
 */
const generateUnderlinedPlaceValue: ConceptGenerator = (v, originalQ = '') => {
  const numbers = [
    [7, 8, 4], [5, 9, 2], [3, 6, 7], [9, 1, 4], [2, 6, 8],
    [4, 5, 3], [7, 3, 1], [8, 2, 6], [5, 4, 9], [1, 7, 2],
    [6, 3, 8], [9, 8, 5], [2, 4, 7], [3, 9, 6], [8, 1, 3],
  ];
  const sets = Array.from({ length: 5 }, (_, i) => {
    const digits = numbers[(v * 5 + i) % numbers.length];
    const [h, t, o] = digits;
    // Same format as the original: 7_8_4 → the middle digit (Tens) is underlined.
    return {
      prompt: `${h}_${t}_${o}`,
      answer: String(t * 10),
    };
  });

  return {
    question: 'Identify the place value of the underlined digit:',
    subQuestions: sets,
    answer: '',
    topic: 'Place Value (Underlined Digit)',
    aiGenerated: false,
    remediation: 'The digit between the underscores is the underlined digit. Its place value = digit × its place (Tens = 10, so 8 in 7_8_4 = 80).',
  };
};

const generateNumberSense: ConceptGenerator = (v, originalQ = '') => {
  const isNumeral = /numeral|write the numeral|write.*as a number/i.test(originalQ);
  const isWordForm = /in words|word form|write the number name/i.test(originalQ);

  if (isNumeral) {
    const words = ["twelve", "fifteen", "twenty-eight", "thirty-four", "forty-two", "fifty-seven", "sixty-one", "seventy-six", "eighty-three", "ninety-nine"];
    const answers = ["12", "15", "28", "34", "42", "57", "61", "76", "83", "99"];
    const set = Array.from({ length: 5 }, (_, i) => {
      const idx = (v * 2 + i) % words.length;
      return {
        prompt: `Write the numeral for ${words[idx]}:`,
        answer: answers[idx]
      };
    });
    return {
      question: "Write the numeral for the given number names:",
      subQuestions: set,
      answer: "",
      topic: "Number Sense",
      aiGenerated: false,
      remediation: "Read the number word carefully and write its digit representation (e.g., twelve is 12)."
    };
  }

  if (isWordForm) {
    const numbers = [14, 25, 38, 41, 59, 62, 73, 87, 94, 100];
    const words = ["fourteen", "twenty-five", "thirty-eight", "forty-one", "fifty-nine", "sixty-two", "seventy-three", "eighty-seven", "ninety-four", "one hundred"];
    const set = Array.from({ length: 5 }, (_, i) => {
      const idx = (v * 2 + i) % numbers.length;
      return {
        prompt: `Write ${numbers[idx]} in words:`,
        answer: words[idx]
      };
    });
    return {
      question: "Write the following numbers in word form:",
      subQuestions: set,
      answer: "",
      topic: "Number Sense",
      aiGenerated: false,
      remediation: "Say the number out loud and write down its spelling carefully."
    };
  }

  const base = (v + 1) * 4 + 10;
  const presets = [
    { prompt: `What number comes AFTER ${base}?`, answer: String(base + 1) },
    { prompt: `What number comes BEFORE ${base + 5}?`, answer: String(base + 4) },
    { prompt: `What number is BETWEEN ${base} and ${base + 2}?`, answer: String(base + 1) },
    { prompt: `What number comes AFTER ${base + 7}?`, answer: String(base + 8) },
    { prompt: `What number comes BEFORE ${base + 9}?`, answer: String(base + 8) }
  ];

  return {
    question: "Answer these number sense questions:",
    subQuestions: presets,
    answer: "",
    topic: "Number Sense",
    aiGenerated: false,
    remediation: "Use the number line to find before, after, and between."
  };
};

const generateOrdering: ConceptGenerator = (v, originalQ = '') => {
  const is3Digit = /\b3-digit\b|\b3digit\b|\bhundreds\b|\bhto\b|\b\d{3}\b/i.test(originalQ);

  const sets = Array.from({ length: 5 }, (_, i) => {
    const isAsc = (v + i) % 2 === 0;
    const raw = is3Digit
      ? [(v + i) * 15 + 115, (v + i) * 12 + 130, (v + i) * 18 + 105, (v + i) * 10 + 150]
      : [(v + i) * 6 + 22, (v + i) * 6 + 4, (v + i) * 6 + 15, (v + i) * 6 + 31];
    const sorted = isAsc ? [...raw].sort((a, b) => a - b) : [...raw].sort((a, b) => b - a);
    return { prompt: `Arrange in ${isAsc ? 'ASCENDING' : 'DESCENDING'} order: ${raw.join(", ")}`, answer: sorted.join(", ") };
  });

  return {
    question: "Arrange each set of numbers in order as requested:",
    subQuestions: sets,
    answer: "",
    topic: "Ordering",
    aiGenerated: false,
    remediation: "Compare place values and sort accordingly."
  };
};

const generateComparison: ConceptGenerator = (v, originalQ = '') => {
  const is3Digit = /\b3-digit\b|\b3digit\b|\bhundreds\b|\bhto\b|\b\d{3}\b/i.test(originalQ);
  const sets = Array.from({ length: 5 }, (_, i) => {
    const vA = is3Digit ? (v + i + 1) * 35 + 140 : (v + i + 1) * 9 + 14;
    const vB = is3Digit ? (v + i + 1) * 28 + 165 : (v + i + 1) * 7 + 19;
    return { prompt: `${vA} vs ${vB}`, answer: String(Math.max(vA, vB)) };
  });

  return {
    question: "Which number is greater in each case:",
    subQuestions: sets,
    answer: "",
    topic: "Comparison",
    aiGenerated: false,
    remediation: "Use >, <, = to compare values."
  };
};
const generateAddition: ConceptGenerator = (v, originalQ = '') => {
  const is3Digit = /\b3-digit\b|\b3digit\b|\bcarry\b|\bcarrying\b|\bhundreds\b|\bhto\b|\b\d{3}\b/i.test(originalQ);

  const sets = Array.from({ length: 5 }, (_, i) => {
    if (is3Digit) {
      const a3 = 160 + (v % 5) * 15 + i * 2;
      const b3 = 230 + (v % 5) * 12 + i * 3;
      return { prompt: `Problem ${i + 1}: ${a3} + ${b3} = ?`, answer: String(a3 + b3) };
    } else {
      const a = 15 + (v % 6) * 5 + i * 3;
      const b = 20 + (v % 6) * 4 + i * 2;
      return { prompt: `Problem ${i + 1}: ${a} + ${b} = ?`, answer: String(a + b) };
    }
  });

  return {
    question: "Solve the following addition problems:",
    subQuestions: sets,
    answer: "",
    topic: "Addition",
    aiGenerated: false,
    remediation: "Add digits from right to left, carry if needed."
  };
};

const generateSubtraction: ConceptGenerator = (v, originalQ = '') => {
  const is3Digit = /\b3-digit\b|\b3digit\b|\bborrow\b|\bborrowing\b|\bhundreds\b|\bhto\b|\b\d{3}\b/i.test(originalQ);

  const sets = Array.from({ length: 5 }, (_, i) => {
    if (is3Digit) {
      const sA3 = 450 + (v % 5) * 20 + i * 5;
      const sB3 = 140 + (v % 5) * 10 + i * 3;
      return { prompt: `Problem ${i + 1}: ${sA3} - ${sB3} = ?`, answer: String(sA3 - sB3) };
    } else {
      const sA = 45 + (v % 6) * 4 + i * 3;
      const sB = 12 + (v % 6) * 2 + i;
      return { prompt: `Problem ${i + 1}: ${sA} - ${sB} = ?`, answer: String(sA - sB) };
    }
  });

  return {
    question: "Solve the following subtraction problems:",
    subQuestions: sets,
    answer: "",
    topic: "Subtraction",
    aiGenerated: false,
    remediation: "Subtract right to left, borrow if needed."
  };
};

const generateMultiplication: ConceptGenerator = (v) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const a = ((v + i) % 7) + 2;
    const b = ((v + i) % 8) + 3;
    return { prompt: `Problem ${i + 1}: ${a} × ${b} = ?`, answer: String(a * b) };
  });

  return {
    question: "Solve the following multiplication problems:",
    subQuestions: sets,
    answer: "",
    topic: "Multiplication",
    aiGenerated: false,
    remediation: "Multiply numbers using basic multiplication facts."
  };
};

const generateDivision: ConceptGenerator = (v) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const divisor = ((v + i) % 5) + 2;
    const quotient = ((v + i) % 6) + 3;
    const dividend = divisor * quotient;
    return { prompt: `Problem ${i + 1}: ${dividend} ÷ ${divisor} = ?`, answer: String(quotient) };
  });

  return {
    question: "Solve the following division problems:",
    subQuestions: sets,
    answer: "",
    topic: "Division",
    aiGenerated: false,
    remediation: "Divide into equal groups or calculate how many times divisor fits."
  };
};
const generateDivisionEqualSharing: ConceptGenerator = (v) => {
  const kids = (v % 3) + 2;
  const perKid = (v % 4) + 3;
  const total = kids * perKid;
  const items = ['cookies 🍪', 'apples 🍎', 'pencils ✏️', 'toys 🧸', 'candies 🍬'];

  const sets = Array.from({ length: 5 }, (_, i) => {
    const k = kids + i;
    const pk = perKid + i;
    const tot = k * pk;
    return { prompt: `${tot} ${items[(v + i) % items.length]} ÷ ${k} kids`, answer: String(pk) };
  });

  return {
    question: "Share the objects equally among children:",
    subQuestions: sets,
    answer: "",
    topic: "Division (Equal Sharing)",
    aiGenerated: false,
    remediation: "Divide total items by number of children."
  };
};

const generateDivisionEqualGrouping: ConceptGenerator = (v) => {
  const perGroup = (v % 3) + 3;
  const groups = (v % 4) + 2;
  const total = perGroup * groups;
  const objs = ['balls ⚽', 'stars ⭐', 'blocks 🧱', 'cards 🃏', 'buttons 🔘'];

  const sets = Array.from({ length: 5 }, (_, i) => {
    const pg = perGroup + i;
    const g = groups + i;
    const tot = pg * g;
    return { prompt: `${tot} ${objs[(v + i) % objs.length]} ÷ groups of ${pg}`, answer: String(g) };
  });

  return {
    question: "Put the objects into equal groups:",
    subQuestions: sets,
    answer: "",
    topic: "Division (Equal Grouping)",
    aiGenerated: false,
    remediation: "Divide total items by group size."
  };
};

const generatePatterns: ConceptGenerator = (v, originalQ = '') => {
  const isShapePattern = /\b(circle|triangle|square|shape|shapes|pattern sequence)\b/i.test(originalQ);

  if (isShapePattern) {
    const shapePats = [
      { prompt: "Circle, Triangle, Circle, Triangle, ___", answer: "Circle" },
      { prompt: "Square, Circle, Square, Circle, ___", answer: "Square" },
      { prompt: "Triangle, Square, Triangle, Square, ___", answer: "Triangle" },
      { prompt: "Circle, Square, Circle, Square, ___", answer: "Circle" },
      { prompt: "Triangle, Circle, Triangle, Circle, ___", answer: "Triangle" },
    ];
    return {
      question: "Complete the shape pattern sequence:",
      subQuestions: shapePats,
      answer: "",
      topic: "Patterns (Shape Sequences)",
      aiGenerated: false,
      remediation: "Identify the repeating shape sequence."
    };
  }

  const skipPats = [
    { prompt: "2, 4, 6, 8, ___", answer: "10" },
    { prompt: "5, 10, 15, 20, ___", answer: "25" },
    { prompt: "10, 20, 30, 40, ___", answer: "50" },
    { prompt: "3, 6, 9, 12, ___", answer: "15" },
    { prompt: "7, 14, 21, 28, ___", answer: "35" },
  ];
  return {
    question: "Complete the skip counting pattern:",
    subQuestions: skipPats,
    answer: "",
    topic: "Patterns",
    aiGenerated: false,
    remediation: "Identify the rule and continue the sequence."
  };
};
const generateDataHandling: ConceptGenerator = (v) => {
  const presets = [
    { prompt: "6 apples vs 4 oranges", answer: "2" },
    { prompt: "8 apples vs 3 oranges", answer: "5" },
    { prompt: "10 apples vs 6 oranges", answer: "4" },
    { prompt: "7 apples vs 2 oranges", answer: "5" },
    { prompt: "9 apples vs 5 oranges", answer: "4" },
  ];
  return {
    question: "A pictograph chart shows apples and oranges How many more apples than oranges are there?",
    subQuestions: presets,
    answer: "",
    topic: "Data Handling",
    aiGenerated: false,
    remediation: "Subtract oranges from apples."
  };
};


const generateMoney: ConceptGenerator = (v) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const cost = (v + i + 1) * 10;
    const paid = cost + 20;
    return { prompt: `Cost ₹${cost}, Paid ₹${paid}`, answer: `₹${paid - cost}` };
  });
  return {
    question: "Find the change returned:",
    subQuestions: sets,
    answer: "",
    topic: "Money",
    aiGenerated: false,
    remediation: "Subtract cost from amount paid."
  };
};

const generateMeasurement: ConceptGenerator = (v) => {
  const items = [
    { prompt: "Length of pencil", answer: "cm" },
    { prompt: "Water in bucket", answer: "L" },
    { prompt: "Weight of schoolbag", answer: "kg" },
    { prompt: "Length of door", answer: "m" },
    { prompt: "Milk in cup", answer: "mL" },
  ];
  return {
    question: "Which unit is best to measure the following item ",
    subQuestions: items,
    answer: "",
    topic: "Measurement",
    aiGenerated: false,
    remediation: "Select unit based on size/quantity."
  };
};

const generateUnitConversion: ConceptGenerator = (v) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const m = (v + i + 1) * 3 + 2;
    return { prompt: `${m} m`, answer: `${m * 100} cm` };
  });
  return {
    question: "Convert meters to centimeters:",
    subQuestions: sets,
    answer: "",
    topic: "Unit Conversion",
    aiGenerated: false,
    remediation: "Multiply meters by 100."
  };
};

const generateTime: ConceptGenerator = (v) => {
  const baseHour = (Math.abs(v) % 12) + 1;
  const sets = Array.from({ length: 5 }, (_, i) => {
    const rawHour = ((baseHour - 1 + i) % 12) + 1; // strictly 1..12
    const isHalf = i % 2 === 1;
    const nextHour = (rawHour % 12) + 1;
    const handDesc = isHalf
      ? `Short hand between ${rawHour} and ${nextHour}, Long hand on 6`
      : `Short hand on ${rawHour}, Long hand on 12`;

    return {
      prompt: `Clock face showing: ${handDesc}`,
      answer: isHalf ? `${rawHour}:30` : `${rawHour}:00`
    };
  });

  return {
    question: "Read the time shown on each clock:",
    subQuestions: sets,
    answer: "",
    topic: "Time",
    aiGenerated: false,
    remediation: "Short hand = hour, long hand = minutes."
  };
};


const generateGeometry: ConceptGenerator = (v, originalQ = '') => {
  const isAngle = /\b(angle|angles|degree|degrees|protractor|90|acute|obtuse|right)\b/i.test(originalQ);
  if (isAngle) {
    const anglePresets = [
      { prompt: "Angle < 90°", answer: "Acute" },
      { prompt: "Angle = 90°", answer: "Right" },
      { prompt: "Angle > 90° but < 180°", answer: "Obtuse" },
      { prompt: "Angle = 180°", answer: "Straight" },
      { prompt: "Square has how many right angles?", answer: "4" },
    ];
    return {
      question: "Identify the type of angle:",
      subQuestions: anglePresets,
      answer: "",
      topic: "Geometry (Angles)",
      aiGenerated: false,
      remediation: "Use angle size to classify."
    };
  }

  const shapes = [
    { prompt: "Triangle sides", answer: "3" },
    { prompt: "Square corners", answer: "4" },
    { prompt: "Circle straight sides", answer: "0" },
    { prompt: "Rectangle sides", answer: "4" },
    { prompt: "Pentagon sides", answer: "5" },
  ];
  return {
    question: "Answer these geometry questions:",
    subQuestions: shapes,
    answer: "",
    topic: "Geometry",
    aiGenerated: false,
    remediation: "Count sides and corners."
  };
};


const generateOddOneOut: ConceptGenerator = (v, originalQ = '') => {
  const CATEGORY_MAP: Record<string, string[]> = {
    fruits: ['Apple', 'Banana', 'Orange', 'Grapes', 'Mango', 'Strawberry', 'Watermelon', 'Pineapple'],
    vehicles: ['Car', 'Bus', 'Train', 'Bicycle', 'Truck', 'Airplane', 'Helicopter', 'Boat'],
    stationery: ['Pencil', 'Book', 'Ruler', 'Eraser', 'Sharpener', 'Pen', 'Marker', 'Notebook'],
    animals: ['Lion', 'Tiger', 'Elephant', 'Giraffe', 'Zebra', 'Cat', 'Dog', 'Cow'],
    shapes: ['Circle', 'Square', 'Triangle', 'Rectangle', 'Star', 'Pentagon', 'Hexagon', 'Oval'],
    foods: ['Cake', 'Cookie', 'Bread', 'Pizza', 'Burger', 'Sandwich', 'Donut', 'Candy'],
    tools: ['Hammer', 'Screwdriver', 'Wrench', 'Pliers', 'Axe', 'Shovel', 'Rake', 'Saw'],
    clothes: ['Shirt', 'Pants', 'Socks', 'Hat', 'Shoes', 'Dress', 'Jacket', 'Gloves'],
    furniture: ['Table', 'Chair', 'Bed', 'Sofa', 'Desk', 'Bookshelf', 'Cabinet', 'Wardrobe'],
    toys: ['Doll', 'Teddy', 'Ball', 'Blocks', 'Kite', 'Balloon', 'Yo-yo', 'Robot']
  };

  const keys = Object.keys(CATEGORY_MAP);

  const sets = Array.from({ length: 5 }, (_, i) => {
    const mainKey = keys[(v + i) % keys.length];
    
    // Choose an odd key that is guaranteed to be different from the main key
    const oddKey = keys[(v + i + 1 + Math.floor(v / keys.length)) % keys.length];
    
    const mainPool = CATEGORY_MAP[mainKey];
    const oddPool = CATEGORY_MAP[oddKey];

    // Select 5 unique items from the main category
    const mainItems: string[] = [];
    for (let k = 0; k < 5; k++) {
      mainItems.push(mainPool[(v + k) % mainPool.length]);
    }

    // Select 1 item from the odd category
    const oddItem = oddPool[v % oddPool.length];

    // Position of odd item is deterministic but changes for each sub-question
    const insertPos = (v + i) % 6;
    const options = [...mainItems];
    options.splice(insertPos, 0, oddItem);

    return {
      prompt: `[${options.join(', ')}]`,
      answer: oddItem
    };
  });

  return {
    question: "Select the odd one out from each group of objects:",
    subQuestions: sets,
    answer: "",
    topic: "Odd One Out",
    aiGenerated: false,
    remediation: getHumanReadableRemediation("Odd One Out", originalQ)
  };
};


const generateAlgebra: ConceptGenerator = (v) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const x = (v + i) % 7 + 2;
    const y = (v + i) % 9 + 3;
    return { prompt: `x + ${y} = ${x + y}`, answer: String(x) };
  });

  return {
    question: "Solve for x:",
    subQuestions: sets,
    answer: "",
    topic: "Algebra",
    aiGenerated: false,
    remediation: "Subtract constant from RHS."
  };
};

const generateDecimals: ConceptGenerator = (v) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const a = ((v + i) % 9 + 1.2).toFixed(1);
    const b = ((v + i) % 5 + 0.8).toFixed(1);
    return { prompt: `${a} + ${b}`, answer: (parseFloat(a) + parseFloat(b)).toFixed(1) };
  });

  return {
    question: "Add decimals:",
    subQuestions: sets,
    answer: "",
    topic: "Decimals",
    aiGenerated: false,
    remediation: "Align decimal points and add."
  };
};

const generatePercentages: ConceptGenerator = (v) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const part = (v + i + 1) * 10;
    return { prompt: `${part} of 100`, answer: `${part}%` };
  });

  return {
    question: "Find the percent of 100:",
    subQuestions: sets,
    answer: "",
    topic: "Percentages",
    aiGenerated: false,
    remediation: "Percentage = part ÷ 100 × 100."
  };
};
const generateRatios: ConceptGenerator = (v) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const boys = (v + i) % 6 + 2;
    const girls = (v + i) % 5 + 3;
    return { prompt: `${boys} boys, ${girls} girls`, answer: `${boys}:${girls}` };
  });

  return {
    question: "Find the ratio of boys to girls:",
    subQuestions: sets,
    answer: "",
    topic: "Ratios",
    aiGenerated: false,
    remediation: "Write as boys:girls."
  };
};

const generateIntegers: ConceptGenerator = (v) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const a = (v + i) % 10 - 5;
    const b = (v + i) % 8 - 4;
    return { prompt: `${a} + ${b}`, answer: String(a + b) };
  });

  return {
    question: "Add integers:",
    subQuestions: sets,
    answer: "",
    topic: "Integers",
    aiGenerated: false,
    remediation: "Use number line to add."
  };
};

const generateStatistics: ConceptGenerator = (v) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const scores = [45, 50, 55, 60].map(s => s + v + i);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    return { prompt: scores.join(", "), answer: mean.toFixed(1) };
  });

  return {
    question: "Find the mean (average):",
    subQuestions: sets,
    answer: "",
    topic: "Statistics",
    aiGenerated: false,
    remediation: "Add values and divide by count."
  };
};

const generateProbability: ConceptGenerator = (v) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const favorable = ((v + i) % 6) + 1;
    return { prompt: `Roll a ${favorable}`, answer: `${favorable}/6` };
  });

  return {
    question: "Find the probability of rolling each outcome on a fair 6‑sided die:",
    subQuestions: sets,
    answer: "",
    topic: "Probability",
    aiGenerated: false,
    remediation: "Probability = favorable outcomes ÷ total outcomes."
  };
};

const generateWordProblems: ConceptGenerator = (v) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const pens = (v + i + 1) * 3;
    const cost = pens * 5;
    return { prompt: `${pens} pens at ₹5 each`, answer: `₹${cost}` };
  });

  return {
    question: "What is the total cost?",
    subQuestions: sets,
    answer: "",
    topic: "Word Problems",
    aiGenerated: false,
    remediation: "Multiply number of pens by cost per pen."
  };
};

const generateOrdinalNumbers: ConceptGenerator = (v) => {
  const positions = ["1st", "2nd", "3rd", "4th", "5th"];
  const animals = ["Cat 🐱", "Dog 🐶", "Rabbit 🐰", "Panda 🐼", "Fox 🦊"];
  const sets = Array.from({ length: 5 }, (_, i) => {
    const idx = (v + i) % positions.length;
    return { prompt: animals[idx], answer: positions[idx] };
  });

  return {
    question: "Identify the position of each animal in the queue:",
    subQuestions: sets,
    answer: "",
    topic: "Ordinal Numbers",
    aiGenerated: false,
    remediation: "Ordinal numbers show position in a series."
  };
};
// ─── DYNAMIC POOL & SHUFFLE UTILITIES FOR MATCHING EXERCISES ────────────────
const FRUIT_POOL = [
  'Apple 🍎', 'Banana 🍌', 'Orange 🍊', 'Grapes 🍇', 'Mango 🥭',
  'Pineapple 🍍', 'Strawberry 🍓', 'Watermelon 🍉', 'Pear 🍐', 'Kiwi 🥝',
  'Papaya 🥭', 'Peach 🍑', 'Cherry 🍒', 'Lemon 🍋'
];

function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let m = result.length;
  let t: T, i: number;
  let s = Math.abs(Math.sin(seed + 1) * 10000);
  while (m) {
    i = Math.floor((s - Math.floor(s)) * m--);
    s = Math.abs(Math.sin(s + m) * 10000);
    t = result[m];
    result[m] = result[i];
    result[i] = t;
  }
  return result;
}

export function generateMatchingExercise(
  v: number,
  sourceItems: string[],
  targetPool: string[],
  topicName: string,
  sourceLabel: string = 'item',
  targetLabel: string = 'target'
): BlueprintQuestion {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const selectedTargets = shuffleWithSeed(targetPool, (v + i) * 17 + 5).slice(0, sourceItems.length);
    const idx = (v + i) % sourceItems.length;
    const source = sourceItems[idx];
    const target = selectedTargets[idx];
    return { prompt: `${source}`, answer: target };
  });

  return {
    question: `Match each ${sourceLabel} to the correct ${targetLabel}:`,
    subQuestions: sets,
    answer: "", // dummy to satisfy type
    topic: topicName,
    aiGenerated: false,
    remediation: `Match each ${sourceLabel} with its corresponding ${targetLabel}.`
  };
}


const generateMatchFingersToFruits: ConceptGenerator = (v) => {
  const fingers = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'];
  const sets = Array.from({ length: 5 }, (_, i) => {
    const idx = (v + i) % fingers.length;
    return { prompt: fingers[idx], answer: FRUIT_POOL[(v + i) % FRUIT_POOL.length] };
  });

  return {
    question: "Match each finger to the correct fruit:",
    subQuestions: sets,
    answer: "",
    topic: "Match Fingers to Fruits",
    aiGenerated: false,
    remediation: "Each finger is paired with a fruit."
  };
};

function toTallyString(n: number): string {
  const fives = Math.floor(n / 5);
  const rem = n % 5;
  const groups: string[] = [];
  for (let i = 0; i < fives; i++) {
    groups.push('||||/');
  }
  if (rem > 0) {
    groups.push('|'.repeat(rem));
  }
  return groups.join(' ');
}

const generateMatchTheTallies: ConceptGenerator = (v) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const count = ((v + i) % 12) + 3;
    const tallyStr = toTallyString(count);
    return { prompt: tallyStr, answer: String(count) };
  });

  return {
    question: "Count the tally marks and match the number:",
    subQuestions: sets,
    answer: "",
    topic: "Match the Tallies",
    aiGenerated: false,
    remediation: "Each group of ||||/ = 5, add singles for total."
  };
};

const generateAddAndMatch: ConceptGenerator = (v) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const num1 = (v + i + 1) * 4 + 3;
    const num2 = (v + i + 1) * 3 + 5;
    const sum = num1 + num2;
    return { prompt: `${num1} + ${num2}`, answer: String(sum) };
  });

  return {
    question: "Solve addition and match the correct option:",
    subQuestions: sets,
    answer: "",
    topic: "Add and Match",
    aiGenerated: false,
    remediation: "Add the two numbers and select the sum."
  };
};

function numberToEnglishDecimal(val: number): string {
  const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen'];
  const parts = val.toFixed(1).split('.');
  const whole = parseInt(parts[0], 10);
  const frac = parseInt(parts[1], 10);
  const wholeStr = words[whole] || String(whole);
  const fracStr = words[frac] || String(frac);
  return `${wholeStr} point ${fracStr.toLowerCase()}`;
}

const generateReadWriteDecimals: ConceptGenerator = (v) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const value = parseFloat(((v + i) * 0.7 + 1.2).toFixed(1));
    return { prompt: `${value.toFixed(1)}`, answer: numberToEnglishDecimal(value) };
  });

  return {
    question: "Write each decimal number in English words:",
    subQuestions: sets,
    answer: "",
    topic: "Read & Write Decimals",
    aiGenerated: false,
    remediation: "Say the whole number part, then point, then the decimal part."
  };
};


const generateCompareDecimals: ConceptGenerator = (v) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const a = (20 + v + i) / 10;
    const b = a + 0.2;
    return { prompt: `${a.toFixed(1)} vs ${b.toFixed(1)}`, answer: b.toFixed(1) };
  });

  return {
    question: "Which decimal is greater?",
    subQuestions: sets,
    answer: "",
    topic: "Compare Decimals",
    aiGenerated: false,
    remediation: "Compare digits from left to right."
  };
};


const generateDecimalsInMoney: ConceptGenerator = (v) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const cost = 12.50 + v + i;
    const paid = 20.00;
    return { prompt: `Cost ₹${cost.toFixed(2)}, Paid ₹${paid.toFixed(2)}`, answer: `₹${(paid - cost).toFixed(2)}` };
  });

  return {
    question: "Find the change returned:",
    subQuestions: sets,
    answer: "",
    topic: "Decimals in Money",
    aiGenerated: false,
    remediation: "Subtract cost from amount paid, keep two decimal places."
  };
};

const generateWritePosition: ConceptGenerator = (v) => {
  const items = ['apple', 'banana', 'mango', 'grapes', 'orange'];
  const sets = Array.from({ length: 5 }, (_, i) => {
    const pos = ((v + i) % items.length) + 1;
    return { prompt: `${items[pos - 1]}`, answer: `${pos}` };
  });

  return {
    question: "Write the position of each item in the list:",
    subQuestions: sets,
    answer: "",
    topic: "Write Position",
    aiGenerated: false,
    remediation: "Count items from left to right."
  };
};

const generateIdentifyPosition: ConceptGenerator = (v) => {
  const items = ['dog', 'cat', 'rabbit', 'parrot', 'fish'];
  const sets = Array.from({ length: 5 }, (_, i) => {
    const pos = ((v + i) % items.length) + 1;
    return { prompt: `Position ${pos}`, answer: items[pos - 1] };
  });

  return {
    question: "Identify the animal at each position:",
    subQuestions: sets,
    answer: "",
    topic: "Identify Position",
    aiGenerated: false,
    remediation: "Look at the list and count carefully."
  };
};

const generateCountEqualGroups: ConceptGenerator = (v) => {
  const items = ['stars ⭐', 'apples 🍎', 'cookies 🍪', 'balloons 🎈', 'pencils ✏️'];
  const sets = Array.from({ length: 5 }, (_, i) => {
    const groupSize = ((v + i) % 5) + 2;
    const groups = ((v + i * 2) % 4) + 2;
    return {
      prompt: `${groups} equal groups of ${groupSize} ${items[i % items.length]}`,
      answer: String(groupSize * groups)
    };
  });

  return {
    question: "Count the total objects in equal groups:",
    subQuestions: sets,
    answer: "",
    topic: "Count Equal Groups",
    aiGenerated: false,
    remediation: "Multiply number of groups by size of each group."
  };
};

///
const generateRepeatedAddition: ConceptGenerator = (v) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const number = ((v + i) % 5) + 2;
    const times = ((v + i * 2) % 3) + 3;
    const expr = Array(times).fill(number).join(" + ");
    return {
      prompt: `Problem ${i + 1}: ${expr} = ?`,
      answer: String(number * times)
    };
  });

  return {
    question: "Solve by repeated addition:",
    subQuestions: sets,
    answer: "",
    topic: "Repeated Addition",
    aiGenerated: false,
    remediation: "Repeated addition is multiplication."
  };
};

////
const generateMultiplicationTable: ConceptGenerator = (v) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const a = ((v + i) % 9) + 1;
    const b = ((v + i * 2) % 9) + 1;
    return { prompt: `${a} × ${b}`, answer: String(a * b) };
  });

  return {
    question: "Complete the multiplication table:",
    subQuestions: sets,
    answer: "",
    topic: "Complete the Multiplication Table",
    aiGenerated: false,
    remediation: "Use multiplication facts for 1‑digit numbers."
  };
};

////
const generateAdditionObjects: ConceptGenerator = (v, originalQ = '') => {
  const item = /apple|🍎/i.test(originalQ) ? 'apples 🍎' : 'objects';
  const sets = Array.from({ length: 5 }, (_, i) => {
    const a = ((v + i) % 4) + 2;
    const b = ((v + i * 2) % 4) + 2;
    return { prompt: `${'🍎'.repeat(a)} + ${'🍎'.repeat(b)}`, answer: String(a + b) };
  });

  return {
    question: `Add using ${item}:`,
    subQuestions: sets,
    answer: "",
    topic: "Addition (Objects)",
    aiGenerated: false,
    remediation: "Count each group and then add them together."
  };
};

////
const generateNumberSensePlaceValue: ConceptGenerator = (v, originalQ = '') => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const num = ((v * 17 + 13 + i) % 80) + 12;
    const tens = Math.floor(num / 10);
    const ones = num % 10;

    if (/ten/i.test(originalQ)) return { prompt: `${num}`, answer: String(tens) };
    if (/one/i.test(originalQ)) return { prompt: `${num}`, answer: String(ones) };
    return { prompt: `${num}`, answer: `${tens} tens and ${ones} ones` };
  });

  return {
    question: "Break down each number into tens and ones:",
    subQuestions: sets,
    answer: "",
    topic: "Number Sense (Place Value)",
    aiGenerated: false,
    remediation: "Divide by 10 for tens, use last digit for ones."
  };
};

///
const generateGeometryPerimeter: ConceptGenerator = (v) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const side = ((v + i) % 10) + 2;
    return { prompt: `Square side ${side} cm`, answer: `${side * 4} cm` };
  });

  return {
    question: "Find the perimeter of each square:",
    subQuestions: sets,
    answer: "",
    topic: "Geometry (Perimeter)",
    aiGenerated: false,
    remediation: "Perimeter of a square = 4 × side length."
  };
};


///
const generateGeometryAngles: ConceptGenerator = (v) => {
  const presets = [
    { prompt: "Angle = 90°", answer: "Right" },
    { prompt: "Angle < 90°", answer: "Acute" },
    { prompt: "Angle > 90° but < 180°", answer: "Obtuse" },
  ];
  const sets = Array.from({ length: 5 }, (_, i) => presets[(v + i) % presets.length]);

  return {
    question: "Identify the type of angle:",
    subQuestions: sets,
    answer: "",
    topic: "Geometry (Angles)",
    aiGenerated: false,
    remediation: "Use angle size to classify."
  };
};

///
const generateSubtractionObjects: ConceptGenerator = (v, originalQ = '') => {
  const item = /apple|🍎/i.test(originalQ) ? "apples 🍎" :
    /balloon|🎈/i.test(originalQ) ? "balloons 🎈" :
      /star|★/i.test(originalQ) ? "stars ★" : "objects";

  const sets = Array.from({ length: 5 }, (_, i) => {
    const total = ((v + i) % 8) + 6;
    const remove = ((v + i) % 4) + 2;
    return { prompt: `${total} shown, remove ${remove}`, answer: String(total - remove) };
  });

  return {
    question: `Subtract using ${item}:`,
    subQuestions: sets,
    answer: "",
    topic: "Subtraction (Objects)",
    aiGenerated: false,
    remediation: "Count total, take away removed items."
  };
};

///
const generateHowManyPlaceValue: ConceptGenerator = (v, originalQ = '') => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const num = ((v + i) % 90) + 10;
    const tens = Math.floor(num / 10);
    const ones = num % 10;

    if (/ten/i.test(originalQ)) return { prompt: `${num}`, answer: String(tens) };
    if (/one/i.test(originalQ)) return { prompt: `${num}`, answer: String(ones) };
    return { prompt: `${num}`, answer: `${tens} tens and ${ones} ones` };
  });

  return {
    question: "Break down each 2‑digit number into tens and ones:",
    subQuestions: sets,
    answer: "",
    topic: "Number Sense (Place Value)",
    aiGenerated: false,
    remediation: "Divide by 10 for tens, use last digit for ones."
  };
};

///
const generateNumberSenseComparison: ConceptGenerator = (v, originalQ = '') => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const a = ((v + i) * 3 + 1) % 9 + 1;
    let b = ((v + i) * 5 + 4) % 9 + 1;
    if (a === b) b = (b % 9) + 1;

    const ans = String(Math.max(a, b));
    return { prompt: `${a} vs ${b}`, answer: ans };
  });

  return {
    question: "Compare the numbers:",
    subQuestions: sets,
    answer: "",
    topic: "Number Sense (Comparison)",
    aiGenerated: false,
    remediation: "Compare the two numbers and choose the larger one."
  };
};

///
const generateNumberSenseCounting: ConceptGenerator = (v, originalQ = '') => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    if (/finger|hand|thumb|index|middle|ring|little/i.test(originalQ)) {
      const count = ((v + i) % 5) + 1;
      return { prompt: `🖐️ (${count} fingers)`, answer: String(count) };
    }

    if (/star|★/i.test(originalQ)) {
      const count = ((v + i) % 10) + 5;
      return { prompt: `${'★'.repeat(count)}`, answer: String(count) };
    }

    if (/apple|🍎/i.test(originalQ)) {
      const count = ((v + i) % 6) + 2;
      return { prompt: `${'🍎'.repeat(count)}`, answer: String(count) };
    }

    if (/balloon|🎈/i.test(originalQ)) {
      const count = ((v + i) % 6) + 3;
      return { prompt: `${'🎈'.repeat(count)}`, answer: String(count) };
    }

    // fallback
    const count = ((v + i) % 5) + 3;
    const symbols = ['🔵', '⭐', '🍎', '🎈', '🌸', '🚗', '🍪', '🐱'][(v + i) % 8];
    return { prompt: `${symbols.repeat(count)}`, answer: String(count) };
  });

  return {
    question: "Count the items shown:",
    subQuestions: sets,
    answer: "",
    topic: "Number Sense (Counting)",
    aiGenerated: false,
    remediation: "Count each item one by one to find the total."
  };
};

const generateCountSquareUnits: ConceptGenerator = (v) => {
  // Generate visual grid shapes (rectangles/squares) with different dimensions
  // Students count the unit squares to find the area
  const shapes = [
    { type: 'square', side: 3, unit: 'cm' },
    { type: 'rectangle', length: 4, breadth: 3, unit: 'cm' },
    { type: 'square', side: 5, unit: 'cm' },
    { type: 'rectangle', length: 6, breadth: 2, unit: 'cm' },
    { type: 'rectangle', length: 5, breadth: 4, unit: 'cm' },
    { type: 'square', side: 4, unit: 'm' },
    { type: 'rectangle', length: 7, breadth: 3, unit: 'm' },
    { type: 'square', side: 6, unit: 'm' },
    { type: 'rectangle', length: 8, breadth: 2, unit: 'm' },
    { type: 'rectangle', length: 6, breadth: 5, unit: 'cm' },
  ];

  const offset = (v * 5) % shapes.length;
  const selected = Array.from({ length: 5 }, (_, i) => shapes[(offset + i) % shapes.length]);

  const sets = selected.map((shape, i) => {
    const area = shape.type === 'square' ? shape.side * shape.side : shape.length * shape.breadth;
    const dims = shape.type === 'square'
      ? `${shape.side}×${shape.side} ${shape.unit} grid`
      : `${shape.length}×${shape.breadth} ${shape.unit} grid`;
    return {
      prompt: `Count the unit squares in the ${shape.type} (${dims}):`,
      answer: `${area} square ${shape.unit}`
    };
  });

  return {
    question: "Count the square units in each grid shape:",
    subQuestions: sets,
    answer: "",
    topic: "Count the Square Units",
    aiGenerated: false,
    remediation: "Count each small square in the grid. Area = number of unit squares."
  };
};

const generateCompareShapeAreas: ConceptGenerator = (v) => {
  // Generate pairs of shapes and ask which has greater area
  const shapePairs = [
    { a: { type: 'square', side: 4 }, b: { type: 'rectangle', length: 5, breadth: 3 } },
    { a: { type: 'rectangle', length: 6, breadth: 4 }, b: { type: 'square', side: 5 } },
    { a: { type: 'square', side: 6 }, b: { type: 'rectangle', length: 7, breadth: 5 } },
    { a: { type: 'rectangle', length: 8, breadth: 3 }, b: { type: 'square', side: 5 } },
    { a: { type: 'rectangle', length: 9, breadth: 4 }, b: { type: 'rectangle', length: 7, breadth: 5 } },
    { a: { type: 'square', side: 7 }, b: { type: 'rectangle', length: 8, breadth: 6 } },
    { a: { type: 'rectangle', length: 10, breadth: 3 }, b: { type: 'square', side: 6 } },
    { a: { type: 'square', side: 5 }, b: { type: 'rectangle', length: 6, breadth: 4 } },
    { a: { type: 'rectangle', length: 7, breadth: 6 }, b: { type: 'square', side: 6 } },
    { a: { type: 'rectangle', length: 8, breadth: 5 }, b: { type: 'rectangle', length: 9, breadth: 4 } },
  ];

  const offset = (v * 5) % shapePairs.length;
  const selected = Array.from({ length: 5 }, (_, i) => shapePairs[(offset + i) % shapePairs.length]);

  const sets = selected.map((pair, i) => {
    const areaA = pair.a.type === 'square' ? pair.a.side * pair.a.side : pair.a.length * pair.a.breadth;
    const areaB = pair.b.type === 'square' ? pair.b.side * pair.b.side : pair.b.length * pair.b.breadth;
    const descA = pair.a.type === 'square'
      ? `Square with side ${pair.a.side} cm`
      : `Rectangle ${pair.a.length} cm × ${pair.a.breadth} cm`;
    const descB = pair.b.type === 'square'
      ? `Square with side ${pair.b.side} cm`
      : `Rectangle ${pair.b.length} cm × ${pair.b.breadth} cm`;
    const correct = areaA > areaB ? 'A' : 'B';
    const correctDesc = areaA > areaB ? descA : descB;

    return {
      prompt: `Shape A: ${descA}\nShape B: ${descB}\nWhich shape has the greater area? (Answer: A or B)`,
      answer: correct,
      correctShape: correctDesc
    };
  });

  return {
    question: "Compare the two shapes and identify which has the greater area:",
    subQuestions: sets,
    answer: "",
    topic: "Compare Shape Areas",
    aiGenerated: false,
    remediation: "Calculate area of each shape (square: side×side, rectangle: length×breadth) and compare."
  };
};

// ─── GENERATOR REGISTRY ────────────────────────────────────────────────────────
const GENERATORS: Record<string, ConceptGenerator> = {
  'fractions': generateFractions,
  'directions': generateDirections,
  'direction': generateDirections,
  'shortest path': generateShortestPath,
  'shortestpath': generateShortestPath,
  'map interpretation': generateMapInterpretation,
  'mapinterpretation': generateMapInterpretation,
  'map': generateMapInterpretation,
  'common factors': generateCommonFactors,
  'commonfactors': generateCommonFactors,
  'hcf': generateCommonFactors,
  'factors': generateFactors,
  'factor': generateFactors,
  'common multiples': generateCommonMultiples,
  'commonmultiples': generateCommonMultiples,
  'count the square units': generateCountSquareUnits,
  'countthesquareunits': generateCountSquareUnits,
  'count square units': generateCountSquareUnits,
  'countsquareunits': generateCountSquareUnits,
  'compare shape areas': generateCompareShapeAreas,
  'compareshapeareas': generateCompareShapeAreas,
  'compare shape area': generateCompareShapeAreas,
  'find the area': generateCountSquareUnits,
  'findthearea': generateCountSquareUnits,
  'visual problems': generateCompareShapeAreas,
  'visualproblems': generateCompareShapeAreas,
  'lcm': generateCommonMultiples,
  'multiples': generateMultiples,
  'multiple': generateMultiples,
  'complete the whole': generateCompleteTheWhole,
  'place value': generatePlaceValue,
  'number sense': generateNumberSense,
  'ordering': generateOrdering,
  'comparison': generateComparison,
  'addition': generateAddition,
  'subtraction': generateSubtraction,
  'multiplication': generateMultiplication,
  'number sense (comparison)': generateNumberSenseComparison,
  'division': generateDivision,
  'division (equal sharing)': generateDivisionEqualSharing,
  'equal sharing': generateDivisionEqualSharing,
  'division (equal grouping)': generateDivisionEqualGrouping,
  'equal grouping': generateDivisionEqualGrouping,
  'patterns': generatePatterns,
  'data handling': generateDataHandling,
  'money': generateMoney,
  'measurement': generateMeasurement,
  'unit conversion': generateUnitConversion,
  'time': generateTime,
  'geometry': generateGeometry,
  'odd one out': generateOddOneOut,
  'odd-one-out': generateOddOneOut,
  'odd-one-out-same-icon': generateOddOneOut,
  'odd one out (6 objects)': generateOddOneOut,
  'odd one out (5 objects)': generateOddOneOut,
  'odd one out (same picture)': generateOddOneOut,
  'algebra': generateAlgebra,
  'decimals': generateDecimals,
  'percentages': generatePercentages,
  'ratios': generateRatios,
  'integers': generateIntegers,
  'statistics': generateStatistics,
  'probability': generateProbability,
  'word problems': generateWordProblems,
  'ordinal numbers': generateOrdinalNumbers,
  'matchfingerstofruits': generateMatchFingersToFruits,
  'match fingers to fruits': generateMatchFingersToFruits,
  'add and match': generateAddAndMatch,
  'addandmatch': generateAddAndMatch,
  'match the tallies': generateMatchTheTallies,
  'matchthetallies': generateMatchTheTallies,
  'tally marks': generateMatchTheTallies,
  'tally': generateMatchTheTallies,
  'read & write decimals': generateReadWriteDecimals,
  'compare decimals': generateCompareDecimals,
  'decimals in money': generateDecimalsInMoney,
  'write position': generateWritePosition,
  'identify position': generateIdentifyPosition,
  'count equal groups': generateCountEqualGroups,
  'repeated addition': generateRepeatedAddition,
  'complete the multiplication table': generateMultiplicationTable,
  'addition (objects)': generateAdditionObjects,
  'subtraction (objects)': generateSubtractionObjects,
  'number sense (place value)': generateNumberSensePlaceValue,
  'place value (underlined digit)': generateUnderlinedPlaceValue,
  'place value (underlined)': generateUnderlinedPlaceValue,
  'placevalueunderlineddigit': generateUnderlinedPlaceValue,
  'number sense (counting)': generateNumberSenseCounting,
  'geometry (perimeter)': generateGeometryPerimeter,
  'geometry (angles)': generateGeometryAngles,
};

/**
 * Dynamically register a new concept generator without editing core engine code.
 */
export function registerConceptGenerator(conceptKey: string, generator: ConceptGenerator): void {
  GENERATORS[conceptKey.toLowerCase()] = generator;
}



// ─── generateByConcept ─────────────────────────────────────────────────────────
/**
 * Dynamic registry lookup per concept.
 * All generators produce 100% human-readable, answerable practice questions.
 * answerMode is attached automatically from getAnswerMode() — no need to set it per return.
 */
export function generateByConcept(
  concept: string,
  variantIndex: number,
  originalQ: string = '',
  originalAnswer: string = ''
): BlueprintQuestion {
  const result = _generateByConcept(concept, variantIndex, originalQ, originalAnswer);
  result.answerMode = getAnswerMode(result.topic);
  if (!result.remediation) {
    result.remediation = getHumanReadableRemediation(result.topic || concept, originalQ);
  }
  return result;
}

/** Internal implementation — uses the GENERATORS registry */
function _generateByConcept(
  concept: string,
  variantIndex: number,
  originalQ: string = '',
  originalAnswer: string = ''
): BlueprintQuestion {
  // Resolve canonical concept key from conceptDictionary using detectConcept
  const canonical = detectConcept(originalQ, concept);
  let c = ((canonical && canonical !== 'General') ? canonical : (concept || '')).toLowerCase().trim();

  // Normalize/Map specific FLN worksheet slugs to core concepts
  if (
    c.startsWith('number sense') ||
    c.endsWith('(objects)') ||
    c.startsWith('geometry (')
  ) {
    // Keep exact sub-concept key for dedicated context-aware generator
  } else if (c.includes('odd one out') || c.includes('odd-one-out')) {
    c = 'odd one out';
  } else if (c.includes('ordinal') || c.includes('position')) {
    c = 'ordinal numbers';
  } else if (c.includes('measurement') || c.includes('ruler-measure') || c.includes('measure-objects')) {
    c = 'measurement';
  } else if (c.includes('comparison') || c.includes('compare')) {
    c = 'comparison';
  } else if (c.includes('tally') || c.includes('tallies')) {
    c = 'match the tallies';
  } else if (c.includes('pattern') || c.includes('patterns')) {
    c = 'complete the patterns';
  } else if ((c.includes('clock') || c.includes('time')) && !c.includes('match')) {
    c = 'read the clock';
  } else if (c.includes('finger') || c.includes('fruit')) {
    c = 'match fingers to fruits';
  } else if (c.includes('add and match')) {
    c = 'add and match';
  } else if (c.includes('decimal')) {
    if (c.includes('compare')) c = 'compare decimals';
    else if (c.includes('money')) c = 'decimals in money';
    else c = 'read & write decimals';
  }




  // ── COMPLETE THE PATTERNS (shape sequences) ────────────────
  if (c === 'complete the patterns' || c.replace(/\s+/g, '') === 'completethepatterns') {
    const sequences = [
      { seq: ['Circle', 'Triangle', 'Circle', 'Triangle'], answer: 'Circle' },
      { seq: ['Square', 'Circle', 'Square', 'Circle'], answer: 'Square' },
      { seq: ['Triangle', 'Square', 'Triangle', 'Square'], answer: 'Triangle' },
      { seq: ['Circle', 'Square', 'Circle', 'Square'], answer: 'Circle' },
      { seq: ['Triangle', 'Circle', 'Triangle', 'Circle'], answer: 'Triangle' }
    ];
    const variant = sequences[variantIndex % sequences.length];

    return {
      question: `Complete the shape pattern sequence: ${variant.seq.join(', ')} , ___`,
      options: Array.from(new Set(variant.seq)),
      answer: variant.answer,
      topic: 'Complete the Patterns',
      remediation: getHumanReadableRemediation('Complete the Patterns', originalQ),
      aiGenerated: true
    };
  }

  // ── READ THE CLOCK ─────────────────────────────────────────
  // FIX: this used to reimplement clock generation inline with
  // `const hours = 3 + variantIndex` and NO wraparound, so once variantIndex
  // climbed past ~9 the "hour" printed as 13, 14, 15... which isn't a valid
  // clock reading. `generateTime` (registered under the 'time' key below)
  // already does this correctly — it wraps hours with `% 12` and returns the
  // "1 instruction line + 5 subQuestions" shape — so we just delegate to it.
  if (c === 'read the clock' || c.replace(/\s+/g, '') === 'readtheclock') {
    return generateTime(variantIndex, originalQ, originalAnswer);
  }

  // ── MATCH TIME AND CLOCK ──────────────────────────────────
  if (c === 'match time and clock' || c.replace(/\s+/g, '') === 'matchtimeandclock') {
    const sets = Array.from({ length: 5 }, (_, i) => {
      const rawHour = ((variantIndex + i + 2) % 12) + 1;
      const isHalf = (i % 2 === 1);
      const timeStr = `${rawHour}:${isHalf ? '30' : '00'}`;
      const handDesc = isHalf
        ? `Short hand between ${rawHour} and ${(rawHour % 12) + 1}, Long hand on 6`
        : `Short hand on ${rawHour}, Long hand on 12`;
      return {
        prompt: `Digital Time ${timeStr} → ${handDesc}`,
        answer: `Clock showing ${timeStr}`
      };
    });

    return {
      question: "Match each time with the correct clock face:",
      subQuestions: sets,
      answer: "",
      topic: "Match Time and Clock",
      aiGenerated: false,
      remediation: getHumanReadableRemediation('Match Time and Clock', originalQ)
    };
  }

  // ── UNDERLINED-DIGIT PLACE VALUE (paper format 7_8_4) ─────
  // Route on the exact instruction wording from the paper generator so every
  // variant matches the original question format, whatever the concept slug is.
  if (/identify the place value of the underlined digit/i.test(originalQ)) {
    return generateUnderlinedPlaceValue(variantIndex, originalQ);
  }

  // ── OTHER REGISTERED GENERATORS ───────────────────────────
  if (c === 'matchfingerstofruits' || c.replace(/\s+/g, '') === 'matchfingerstofruits') {
    return generateMatchFingersToFruits(variantIndex, originalQ, originalAnswer);
  }
  if (c === 'add and match' || c.replace(/\s+/g, '') === 'addandmatch') {
    return generateAddAndMatch(variantIndex, originalQ, originalAnswer);
  }
  if (c === 'match the tallies' || c.includes('tally') || c.replace(/\s+/g, '') === 'matchthetallies') {
    return generateMatchTheTallies(variantIndex, originalQ, originalAnswer);
  }

  const gen = GENERATORS[c] || GENERATORS[c.replace(/\s+/g, '')];
  if (gen) return gen(variantIndex, originalQ, originalAnswer);

  // ── DEFAULT FALLBACK ──────────────────────────────────────
  const fallbackQuestions = Array.from({ length: 5 }, (_, i) => {

    const ctx = (concept || '').toLowerCase();

    // Perimeter of square
    if (/perimeter.*square|square.*perimeter/.test(ctx)) {
      const side = 7 + i;

      return {
        prompt: `Problem ${i + 1}: Find the perimeter of the square with side ${side} cm.`,
        answer: `${side * 4} cm`
      };
    }


    // Area of square
    if (/area.*square|square.*area/.test(ctx)) {
      const side = 5 + i;

      return {
        prompt: `Problem ${i + 1}: Find the area of the square with side ${side} cm.`,
        answer: `${side * side} cm²`
      };
    }


    // Area of rectangle
    if (/area.*rectangle|rectangle.*area/.test(ctx)) {
      const length = 10 + i;
      const width = 5 + i;

      return {
        prompt: `Problem ${i + 1}: Find the area of rectangle with length ${length} cm and width ${width} cm.`,
        answer: `${length * width} cm²`
      };
    }


    // Default fallback
    const num1 = (variantIndex + i + 1) * 3 + 4;
    const num2 = (variantIndex + i + 1) * 2 + 5;

    return {
      prompt: `Problem ${i + 1}: Practice question for ${concept || 'this topic'} (${num1} + ${num2} = ?)`,
      answer: String(num1 + num2)
    };
  });

  return {
    question: `Solve the following practice questions for ${concept || 'this topic'}:`,
    subQuestions: fallbackQuestions,
    answer: '',
    topic: concept || 'General',
    remediation: getHumanReadableRemediation(concept, originalQ),
    aiGenerated: true,
    needsReview: true
  };
}

// ─── generateRemediationVariants ──────────────────────────────────────────────
/**
 * Generate `count` endless concept-matched practice questions for one paper question.
 * Concept is auto-detected if not explicitly provided.
 */
export function generateRemediationVariants(
  originalQ: string,
  originalAnswer: string = '',
  count: number = 5,
  hintConcept: string = '',
  baseOffset: number = 0
): BlueprintQuestion[] {
  const cleanQ = sanitizeQuestionText(originalQ);
  const concept = detectConcept(cleanQ, hintConcept);
  console.log("Detected concept:", concept);

  const firstVariant = generateByConcept(concept, baseOffset, cleanQ, originalAnswer);

  // If the concept generator returned a subQuestions array (1 instruction + 5 sub-questions),
  // return that single structured object instead of duplicating it 5 times!
  if (firstVariant.subQuestions && Array.isArray(firstVariant.subQuestions) && firstVariant.subQuestions.length > 0) {
    return [firstVariant];
  }

  return Array.from({ length: count }, (_, i) => {
    const variant = generateByConcept(concept, baseOffset + i, cleanQ, originalAnswer);

    // Always attach remediation so frontend can display it
    variant.remediation = getHumanReadableRemediation(concept, cleanQ);

    return variant;
  });
}


// ─── BlueprintEngine Class ─────────────────────────────────────────────────────
export class BlueprintEngine {
  /**
   * Scalable Domain-Aware Paper Question Mutator.
   *
   * Priority order:
   *  1. Numeric mutator — paper question has numbers → mutate in-place (preserves full sentence)
   *  2. Concept detection → route to the correct topic generator via generator registry
   *  3. Domain-aware fallback — uses conceptName to pick the right operation
   */
  public generate(
    originalQuestion: string,
    conceptName: string,
    questionType: string = 'standard',
    originalAnswer: string = '',
    variantIndex: number = 0
  ): BlueprintQuestion {

    // ── 1. Clean question text ──────────────────────────────────────────────────
    let cleanQ = (originalQuestion || '')
      .replace(/[\s—–-]*Item\s*\d+/gi, '')
      .replace(/[\s—–-]*Question\s*\d+/gi, '')
      .replace(/^Question\s*\d+\s*:\s*/i, '')
      .trim();

    if (!cleanQ) cleanQ = `${conceptName || 'Mathematics'} Question`;

    // ── 2. Concept Detection + Concept Generator ────────────────────────────────
    // Auto-detect concept from question text, then route to the right generator.
    const concept = detectConcept(cleanQ, conceptName);
    const generated = generateByConcept(concept, variantIndex, cleanQ, originalAnswer);

    // If the generator returned a genuine answer (not a needsReview placeholder), use it
    if (!generated.needsReview) {
      return generated;
    }

    // ── 3. Numeric Mutator ──────────────────────────────────────────────────────
    // If the paper question contains numbers, mutate them in-place to produce
    // a structurally identical question with different values.
    const matches = cleanQ.match(/\d+/g);
    if (matches && matches.length >= 1) {
      const nums = matches.map(Number);
      let mutatedText = cleanQ;
      const mutatedNums: number[] = [];

      for (let i = 0; i < nums.length; i++) {
        const origNum = nums[i];
        const step = (variantIndex + 1) * (i + 1) * (origNum > 50 ? 5 : 2);
        const newNum = Math.max(1, origNum + (variantIndex % 2 === 0 ? step : -Math.min(step - 1, origNum - 1)));
        mutatedNums.push(newNum);
        mutatedText = mutatedText.replace(new RegExp(`\\b${origNum}\\b`), String(newNum));
      }

      let ansStr = '';
      if (mutatedNums.length >= 2) {
        // Detect operation from question + concept
        const ctx = `${cleanQ} ${conceptName}`.toLowerCase();
        if (/subtra|minus|take away|change|paid|left|remaining|difference|fewer|less than|spent/.test(ctx) || cleanQ.includes('-')) {
          ansStr = String(Math.max(...mutatedNums) - Math.min(...mutatedNums));
        } else if (/divis|divide|quotient|sharing|grouping|equal groups|per group/.test(ctx) || cleanQ.includes('÷')) {
          ansStr = String(Math.floor(Math.max(...mutatedNums) / (Math.min(...mutatedNums) || 1)));
        } else if (/multipl|times|product|each costs/.test(ctx) || cleanQ.includes('×')) {
          ansStr = String(mutatedNums.reduce((a, b) => a * b, 1));
        } else {
          ansStr = String(mutatedNums.reduce((a, b) => a + b, 0));
        }
      } else if (mutatedNums.length === 1) {
        const low = cleanQ.toLowerCase();
        ansStr = (low.includes('meter') || low.includes('convert') || low.includes('m ='))
          ? String(mutatedNums[0] * 100)
          : String(mutatedNums[0]);
      }

      return { question: mutatedText, answer: ansStr, topic: conceptName || 'Mathematics', aiGenerated: false };
    }

    // ── 4. Domain-Aware Fallback ────────────────────────────────────────────────
    // We still don't know the concept, but we know the question text.
    // Infer the operation from conceptName so we don't default to addition.
    const ctx2 = `${conceptName} ${cleanQ}`.toLowerCase();
    const v1 = (variantIndex + 1) * 7 + 12;
    const v2 = (variantIndex + 1) * 4 + 8;

    let fallbackQ: string;
    let fallbackAns: string;

    if (/subtra|minus|difference|take away|fewer|left|remaining|spent/.test(ctx2)) {
      fallbackQ = `Find the difference: ${v1 + 20} - ${v2} = ?`;
      fallbackAns = String(v1 + 20 - v2);
    } else if (/divis|divide|quotient|sharing|grouping/.test(ctx2)) {
      const dvd = v1 * v2;
      fallbackQ = `Solve division: ${dvd} ÷ ${v2} = ?`;
      fallbackAns = String(v1);
    } else if (/multipl|times|product/.test(ctx2)) {
      fallbackQ = `Solve multiplication: ${v1} × ${v2} = ?`;
      fallbackAns = String(v1 * v2);
    } else if (/perimeter.*square|square.*perimeter/i.test(ctx2)) {

      const side = 7 + variantIndex;

      fallbackQ = `Find the perimeter of the square with side ${side} cm.`;
      fallbackAns = `${side * 4} cm`;

    }
    else if (/area.*square|square.*area/i.test(ctx2)) {

      const side = 5 + variantIndex;

      fallbackQ = `Find the area of the square with side ${side} cm.`;
      fallbackAns = `${side * side} cm²`;

    }
    else if (cleanQ && cleanQ !== `${conceptName || 'Mathematics'} Question`) {

      fallbackQ = `Based on the concept: "${cleanQ}" solve the question.`;
      fallbackAns = String(v1 + v2);

    } else {
      return {
        question: `Practice question for "${conceptName || 'this topic'}" — the original question text wasn't found.`,
        answer: originalAnswer || '',
        topic: conceptName || 'General',
        aiGenerated: false,
        needsReview: true
      };
    }

    return {
      question: fallbackQ,
      answer: fallbackAns,
      topic: conceptName || concept || 'Mathematics',
      aiGenerated: false,
      needsReview: true
    };
  }
}

export const blueprintEngine = new BlueprintEngine();