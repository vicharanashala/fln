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
export function sanitizeQuestionText(text: any): string {
  let str = '';
  if (typeof text === 'string') {
    str = text;
  } else if (typeof text === 'number') {
    str = String(text);
  } else if (Array.isArray(text)) {
    str = text.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(' ');
  } else if (text && typeof text === 'object') {
    const obj = text as any;
    str = obj.question || obj.questionText || obj.text || obj.prompt || obj.content || JSON.stringify(obj);
  } else {
    str = String(text || '');
  }
  return str
    .replace(/☑|☐/g, '')
    .replace(/\bChoose:\s*/gi, '')
    .replace(/\(Choose:[^)]*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function normalizeQuestionText(text: any): string {
  let str = '';
  if (typeof text === 'string') {
    str = text;
  } else if (typeof text === 'number') {
    str = String(text);
  } else if (Array.isArray(text)) {
    str = text.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(' ');
  } else if (text && typeof text === 'object') {
    const obj = text as any;
    str = obj.question || obj.questionText || obj.text || obj.prompt || obj.content || JSON.stringify(obj);
  } else {
    str = String(text || '');
  }
  return str
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

  // --- CUSTOM FLN OVERRIDES FOR CLASS 4 KEYS ---
  if (/num\s*\d+\s*term/i.test(combinedText)) return 'missing numbers';
  if (/number\s*\d+/i.test(combinedText)) return 'missing numbers';
  if (/pair\s*\d+/i.test(combinedText)) return 'comparison';
  if (/set\s*\d+/i.test(combinedText)) return 'addition';
  if (/pencil\s*\d+/i.test(combinedText)) return 'measurement';
  if (/heavier\s*\d+/i.test(combinedText)) return 'measurement';
  if (/shade|fraction/i.test(combinedText)) return 'fractions';
  if (/pat\s*\d+/i.test(combinedText)) return 'patterns';
  if (/count\s*\d+/i.test(combinedText)) return 'number sense (counting)';
  if (/\bmost\b|\bleast\b/i.test(combinedText)) return 'comparison';
  if (/\boperation\b/i.test(combinedText)) return 'addition';
  if (/\bdifference\b/i.test(combinedText)) return 'subtraction';
  if (/\btotal\b/i.test(combinedText)) return 'addition';
  if (/\bx\b/.test(combinedText)) return 'multiplication';
  if (/make\s*(72|₹)/i.test(combinedText)) return 'money';


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
  originalAnswer?: string,
  classLevel?: number
) => BlueprintQuestion;

/**
 * Reusable class-aware numeric constraint helper for all concept generators.
 */
export function generateConstrainedNumber(
  vIndex: number,
  subIndex: number,
  classLevel: number = 5,
  options: {
    min?: number;
    max?: number;
    is3DigitPlaceValue?: boolean;
    step?: number;
  } = {}
): number {
  const step = options.step ?? 7;
  const minVal = options.min ?? 1;
  let maxVal = options.max ?? 1000;

  // Generic class-based limits
  if (classLevel === 2) {
    maxVal = options.is3DigitPlaceValue ? 150 : 50;
  } else if (classLevel === 3) {
    maxVal = options.is3DigitPlaceValue ? 300 : 100;
  } else if (classLevel === 4) {
    maxVal = options.is3DigitPlaceValue ? 500 : 100;
  }

  // Ensure maximum bounds match minVal sensibly
  if (maxVal < minVal) {
    maxVal = minVal + 30;
  }

  const range = maxVal - minVal + 1;
  return minVal + ((vIndex * 13 + subIndex * step) % range);
}

const generateFractions: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const presets = [
    { q: '1 out of 2 equal parts shaded (Choose: 1/2, 1/3, or 1/4)', ans: '1/2' },
    { q: '3 out of 4 equal parts shaded (Choose: 1/4, 2/4, or 3/4)', ans: '3/4' },
    { q: '2 out of 3 equal parts shaded (Choose: 1/3, 2/3, or 3/3)', ans: '2/3' },
    { q: '1 out of 4 equal parts shaded (Choose: 1/4, 2/4, or 3/4)', ans: '1/4' },
    { q: '1 out of 3 equal parts shaded (Choose: 1/3, 2/3, or 3/3)', ans: '1/3' },
    { q: '2 out of 5 equal parts shaded (Choose: 1/5, 2/5, or 3/5)', ans: '2/5' },
    { q: '3 out of 5 equal parts shaded (Choose: 2/5, 3/5, or 4/5)', ans: '3/5' },
    { q: '4 out of 5 equal parts shaded (Choose: 3/5, 4/5, or 5/5)', ans: '4/5' },
  ];

  const set = Array.from({ length: 5 }, (_, i) => presets[(v + i) % presets.length]);

  return {
    question: "Give the answer for what fraction of the shape is shaded:",
    subQuestions: set.map(p => ({ prompt: p.q, answer: p.ans })),
    topic: "Fractions",
    answer: "",
    aiGenerated: false,
    remediation: "Numerator = shaded parts, Denominator = total parts."
  };
};


const generateDirections: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const presets = [
    { prompt: "North", answer: "Park" },
    { prompt: "East", answer: "Library" },
    { prompt: "South", answer: "Bus Stop" },
    { prompt: "West", answer: "Clock Tower" },
    { prompt: "North-East", answer: "Post Office" },
    { prompt: "North-West", answer: "Playground" },
    { prompt: "South-East", answer: "Market" },
    { prompt: "South-West", answer: "Station" }
  ];
  const set = Array.from({ length: 5 }, (_, i) => presets[(v + i) % presets.length]);

  return {
    question: "Identify the place in each direction from the School:",
    subQuestions: set,
    answer: "", // satisfy BlueprintQuestion
    topic: "Directions",
    aiGenerated: false,
    remediation: "Look at cardinal directions (N, E, S, W) relative to the School."
  };
};

const generateShortestPath: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const routes = [
    { prompt: "School → Park (40m vs 70m)", answer: "North route" },
    { prompt: "Library → Bus Stop (30m vs 80m)", answer: "Direct South route" },
    { prompt: "Market → Station (50m vs 90m)", answer: "Main Road" },
    { prompt: "Home → School (25m vs 60m)", answer: "Footpath" },
    { prompt: "Playground → Hospital (35m vs 75m)", answer: "Direct path" },
    { prompt: "School → Garden (15m vs 45m)", answer: "West gate" },
    { prompt: "Classroom → Lab (12m vs 28m)", answer: "Corridor" },
    { prompt: "Office → Gate (60m vs 99m)", answer: "Driveway" }
  ];
  const routesClass5 = [
    { prompt: "School → Park (400m vs 700m)", answer: "North route" },
    { prompt: "Library → Bus Stop (300m vs 800m)", answer: "Direct South route" },
    { prompt: "Market → Station (500m vs 900m)", answer: "Main Road" },
    { prompt: "Home → School (250m vs 600m)", answer: "Footpath" },
    { prompt: "Playground → Hospital (350m vs 750m)", answer: "Direct path" }
  ];
  const pool = classLevel <= 4 ? routes : routesClass5;
  const set = Array.from({ length: 5 }, (_, i) => pool[(v + i) % pool.length]);

  return {
    question: "Choose the shortest path in each case:",
    subQuestions: set,
    answer: "",
    topic: "Shortest Path",
    aiGenerated: false,
    remediation: "Compare distances and select the smaller value."
  };
};

const generateMapInterpretation: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const mapQuestions = [
    { prompt: "On the city map, which building is located next to the Library?", answer: "Post Office" },
    { prompt: "On the park map, what feature is in the center of the park?", answer: "Fountain" },
    { prompt: "According to the legend on the map, what does the blue line represent?", answer: "River" },
    { prompt: "On the school layout map, where is the playground located?", answer: "Behind Main Building" },
    { prompt: "What does the triangle symbol typically represent on a map?", answer: "Temple" },
    { prompt: "On the zoo map, what is next to the lion cage?", answer: "Deer Park" }
  ];
  const set = Array.from({ length: 5 }, (_, i) => mapQuestions[(v + i) % mapQuestions.length]);

  return {
    question: "Answer these map interpretation questions:",
    subQuestions: set,
    answer: "",
    topic: "Map Interpretation",
    aiGenerated: false,
    remediation: "Use map symbols and legends to identify locations."
  };
};


const generateCommonFactors: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const pairs = Array.from({ length: 5 }, (_, i) => {
    let a: number;
    let b: number;
    if (classLevel <= 4) {
      a = generateConstrainedNumber(v, i, classLevel, { min: 6, step: 3 });
      b = generateConstrainedNumber(v, i, classLevel, { min: 4, step: 2 });
    } else {
      a = 12 + (v * 5) + i * 2;
      b = 18 + (v * 3) + i * 2;
    }
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
};

const generateFactors: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const nums = Array.from({ length: 5 }, (_, i) => {
    if (classLevel <= 4) {
      return generateConstrainedNumber(v, i, classLevel, { min: 4, max: 20 });
    }
    return 12 + v * 5 + i;
  });
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

const generateCommonMultiples: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const pairs = Array.from({ length: 5 }, (_, i) => {
    let a: number;
    let b: number;
    if (classLevel <= 4) {
      a = generateConstrainedNumber(v, i, classLevel, { min: 2, max: 6 });
      b = generateConstrainedNumber(v, i + 1, classLevel, { min: 3, max: 7 });
    } else {
      a = 3 + v + i;
      b = 5 + v + i;
    }
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

const generateMultiples: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const nums = Array.from({ length: 5 }, (_, i) => {
    if (classLevel <= 4) {
      return generateConstrainedNumber(v, i, classLevel, { min: 2, max: 10 });
    }
    return 3 + v + i;
  });
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

const generateCompleteTheWhole: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const wholes = Array.from({ length: 5 }, (_, i) => {
    let shaded: number;
    let total: number;
    if (classLevel <= 4) {
      shaded = 1 + (i % 3);
      total = shaded + ((v + i) % 3) + 1;
    } else {
      shaded = (i + 1);
      total = shaded + (v % 5) + 2;
    }
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

const generatePlaceValue: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const is2Digit = /\b2-digit\b|\b2digit\b|\btens-units\b|\btens\b|\bsticks-to-number\b|\btu-grid\b/i.test(originalQ);
  const nums = Array.from({ length: 5 }, (_, i) => {
    if (classLevel <= 4) {
      if (is2Digit) {
        return generateConstrainedNumber(v, i, classLevel, { min: 10, max: 100 });
      } else {
        return generateConstrainedNumber(v, i, classLevel, { min: 100, max: 500, is3DigitPlaceValue: true });
      }
    }
    return is2Digit ? (15 + v * 3 + i * 7) : (100 + v * 7 + i * 11);
  });
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
const generateUnderlinedPlaceValue: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const numbers = [
    [7, 8, 4], [5, 9, 2], [3, 6, 7], [9, 1, 4], [2, 6, 8],
    [4, 5, 3], [7, 3, 1], [8, 2, 6], [5, 4, 9], [1, 7, 2],
  ];
  const numbersClass3 = [
    [2, 4, 5], [1, 3, 8], [3, 2, 4], [2, 5, 1], [1, 4, 7],
    [2, 1, 6], [3, 4, 2], [1, 5, 3], [2, 3, 9], [1, 2, 8]
  ];
  const numbersClass2 = [
    [2, 4], [3, 8], [4, 2], [1, 5], [3, 1],
    [4, 9], [2, 7], [1, 8], [3, 5], [4, 7]
  ];

  const sets = Array.from({ length: 5 }, (_, i) => {
    if (classLevel === 2) {
      const digits = numbersClass2[(v * 5 + i) % numbersClass2.length];
      const [t, o] = digits;
      const isTens = i % 2 === 0;
      return {
        prompt: isTens ? `_${t}_${o}` : `${t}_${o}_`,
        answer: String(isTens ? t * 10 : o),
      };
    }
    const sourceList = classLevel <= 4 ? numbersClass3 : numbers;
    const digits = sourceList[(v * 5 + i) % sourceList.length];
    const [h, t, o] = digits;
    const placeIdx = i % 3;
    if (placeIdx === 0) {
      return { prompt: `_${h}_${t}_${o}`, answer: String(h * 100) };
    } else if (placeIdx === 1) {
      return { prompt: `${h}__${t}__${o}`, answer: String(t * 10) };
    } else {
      return { prompt: `${h}_${t}_${o}_`, answer: String(o) };
    }
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

/** True when the original question is the underlined-digit place value format (7_8_4). */
export function isUnderlinedPlaceValueQuestion(originalQuestion: string): boolean {
  return /identify the place value of the underlined digit/i.test(originalQuestion || '');
}

/** True when stored practice questions already use the underlined-digit format. */
export function isUnderlinedPlaceValuePractice(practiceQuestions: any[]): boolean {
  return (practiceQuestions || []).some((pq: any) => {
    if (/underlined digit/i.test(String(pq?.question || ''))) return true;
    const subs = pq?.subQuestions || [];
    if (Array.isArray(subs) && subs.some((s: any) => /^\d+_\d+_\d+$/.test(String(s?.prompt || '')))) return true;
    return /^\d+_\d+_\d+$/.test(String(pq?.question || ''));
  });
}

const generateNumberSense: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
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

  let base = 10 + ((v * 5) % 80);
  if (classLevel === 2) {
    base = 5 + ((v * 3) % 40);
  } else if (classLevel > 4) {
    base = 100 + ((v * 15) % 800);
  }

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

const generateOrdering: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const is3Digit = /\b3-digit\b|\b3digit\b|\bhundreds\b|\bhto\b|\b\d{3}\b/i.test(originalQ);

  const sets = Array.from({ length: 5 }, (_, i) => {
    const isAsc = (v + i) % 2 === 0;
    let raw: number[];
    if (classLevel <= 4) {
      if (is3Digit) {
        raw = [
          generateConstrainedNumber(v, i, classLevel, { min: 100, is3DigitPlaceValue: true, step: 13 }),
          generateConstrainedNumber(v, i + 1, classLevel, { min: 100, is3DigitPlaceValue: true, step: 17 }),
          generateConstrainedNumber(v, i + 2, classLevel, { min: 100, is3DigitPlaceValue: true, step: 11 }),
          generateConstrainedNumber(v, i + 3, classLevel, { min: 100, is3DigitPlaceValue: true, step: 19 })
        ];
      } else {
        raw = [
          generateConstrainedNumber(v, i, classLevel, { min: 1, max: 100, step: 7 }),
          generateConstrainedNumber(v, i + 1, classLevel, { min: 1, max: 100, step: 11 }),
          generateConstrainedNumber(v, i + 2, classLevel, { min: 1, max: 100, step: 13 }),
          generateConstrainedNumber(v, i + 3, classLevel, { min: 1, max: 100, step: 17 })
        ];
      }
    } else {
      raw = is3Digit
        ? [(v + i) * 15 + 115, (v + i) * 12 + 130, (v + i) * 18 + 105, (v + i) * 10 + 150]
        : [(v + i) * 6 + 22, (v + i) * 6 + 4, (v + i) * 6 + 15, (v + i) * 6 + 31];
    }
    raw = Array.from(new Set(raw));
    while (raw.length < 4) {
      raw.push(raw[raw.length - 1] + 3);
    }
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

const generateComparison: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  if (classLevel <= 4) {
    const sets = Array.from({ length: 5 }, (_, i) => {
      const a = generateConstrainedNumber(v, i, classLevel, { min: 1, max: 100 });
      let b = generateConstrainedNumber(v, i + 1, classLevel, { min: 1, max: 100 });
      if (i === 3) {
        b = a;
      }

      const templateIdx = i % 5;
      if (templateIdx === 0) {
        return { prompt: `Which number is greater: ${a} or ${b}?`, answer: String(Math.max(a, b)) };
      } else if (templateIdx === 1) {
        const sym = a > b ? '>' : a < b ? '<' : '=';
        return { prompt: `Fill in: ${a} __ ${b}`, answer: sym };
      } else if (templateIdx === 2) {
        return { prompt: `Which number is smaller: ${a} or ${b}?`, answer: String(Math.min(a, b)) };
      } else if (templateIdx === 3) {
        const sym = a > b ? '>' : a < b ? '<' : '=';
        return { prompt: `${a} __ ${b}`, answer: sym };
      } else {
        const sym = a > b ? '>' : a < b ? '<' : '=';
        return { prompt: `Fill in: ${a} __ ${b}`, answer: sym };
      }
    });

    return {
      question: "Solve the following comparison problems:",
      subQuestions: sets,
      answer: "",
      topic: "Comparison",
      aiGenerated: false,
      remediation: "Compare values using >, <, = or find the greater/smaller number."
    };
  }

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
const generateAddition: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const is3Digit = /\b3-digit\b|\b3digit\b|\bcarry\b|\bcarrying\b|\bhundreds\b|\bhto\b|\b\d{3}\b/i.test(originalQ);

  const sets = Array.from({ length: 5 }, (_, i) => {
    if (classLevel <= 4) {
      if (is3Digit) {
        const a3 = generateConstrainedNumber(v, i, classLevel, { min: 100, is3DigitPlaceValue: true, step: 13 });
        const b3 = generateConstrainedNumber(v, i + 1, classLevel, { min: 100, is3DigitPlaceValue: true, step: 17 });
        return { prompt: `${a3} + ${b3} = ___`, answer: String(a3 + b3) };
      } else {
        const a = generateConstrainedNumber(v, i, classLevel, { min: 1, max: 100, step: 7 });
        const b = generateConstrainedNumber(v, i + 1, classLevel, { min: 1, max: 100, step: 11 });
        return { prompt: `${a} + ${b} = ___`, answer: String(a + b) };
      }
    }
    if (is3Digit) {
      const a3 = 160 + (v % 5) * 15 + i * 2;
      const b3 = 230 + (v % 5) * 12 + i * 3;
      return { prompt: `${a3} + ${b3} = ___`, answer: String(a3 + b3) };
    } else {
      const a = 15 + (v % 6) * 5 + i * 3;
      const b = 20 + (v % 6) * 4 + i * 2;
      return { prompt: `${a} + ${b} = ___`, answer: String(a + b) };
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

const generateSubtraction: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const is3Digit = /\b3-digit\b|\b3digit\b|\bborrow\b|\bborrowing\b|\bhundreds\b|\bhto\b|\b\d{3}\b/i.test(originalQ);

  const sets = Array.from({ length: 5 }, (_, i) => {
    if (classLevel <= 4) {
      if (is3Digit) {
        const sA3 = generateConstrainedNumber(v, i, classLevel, { min: 200, is3DigitPlaceValue: true, step: 23 });
        const sB3 = generateConstrainedNumber(v, i + 1, classLevel, { min: 50, max: 150, step: 13 });
        return { prompt: `${sA3} - ${sB3} = ___`, answer: String(sA3 - sB3) };
      } else {
        const sA = generateConstrainedNumber(v, i, classLevel, { min: 25, max: 100, step: 13 });
        const sB = generateConstrainedNumber(v, i + 1, classLevel, { min: 1, max: 24, step: 5 });
        return { prompt: `${sA} - ${sB} = ___`, answer: String(sA - sB) };
      }
    }
    if (is3Digit) {
      const sA3 = 450 + (v % 5) * 20 + i * 5;
      const sB3 = 140 + (v % 5) * 10 + i * 3;
      return { prompt: `${sA3} - ${sB3} = ___`, answer: String(sA3 - sB3) };
    } else {
      const sA = 45 + (v % 6) * 4 + i * 3;
      const sB = 12 + (v % 6) * 2 + i;
      return { prompt: `${sA} - ${sB} = ___`, answer: String(sA - sB) };
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

const generateMultiplication: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    let a: number;
    let b: number;
    if (classLevel === 2) {
      a = generateConstrainedNumber(v, i, classLevel, { min: 2, max: 5 });
      b = generateConstrainedNumber(v, i + 1, classLevel, { min: 2, max: 5 });
    } else if (classLevel === 3) {
      a = generateConstrainedNumber(v, i, classLevel, { min: 2, max: 10 });
      b = generateConstrainedNumber(v, i + 1, classLevel, { min: 2, max: 10 });
    } else if (classLevel === 4) {
      a = generateConstrainedNumber(v, i, classLevel, { min: 2, max: 12 });
      b = generateConstrainedNumber(v, i + 1, classLevel, { min: 2, max: 12 });
    } else {
      a = ((v + i) % 7) + 2;
      b = ((v + i) % 8) + 3;
    }
    return { prompt: `${a} × ${b} = ___`, answer: String(a * b) };
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

const generateDivision: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    let divisor: number;
    let quotient: number;
    if (classLevel === 2) {
      divisor = generateConstrainedNumber(v, i, classLevel, { min: 2, max: 4 });
      quotient = generateConstrainedNumber(v, i + 1, classLevel, { min: 2, max: 5 });
    } else if (classLevel === 3) {
      divisor = generateConstrainedNumber(v, i, classLevel, { min: 2, max: 6 });
      quotient = generateConstrainedNumber(v, i + 1, classLevel, { min: 2, max: 8 });
    } else if (classLevel === 4) {
      divisor = generateConstrainedNumber(v, i, classLevel, { min: 2, max: 9 });
      quotient = generateConstrainedNumber(v, i + 1, classLevel, { min: 2, max: 10 });
    } else {
      divisor = ((v + i) % 5) + 2;
      quotient = ((v + i) % 6) + 3;
    }
    const dividend = divisor * quotient;
    return { prompt: `${dividend} ÷ ${divisor} = ___`, answer: String(quotient) };
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
const generateDivisionEqualSharing: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const items = ['cookies 🍪', 'apples 🍎', 'pencils ✏️', 'toys 🧸', 'candies 🍬'];

  const sets = Array.from({ length: 5 }, (_, i) => {
    let k: number;
    let pk: number;
    if (classLevel === 2) {
      k = generateConstrainedNumber(v, i, classLevel, { min: 2, max: 4 });
      pk = generateConstrainedNumber(v, i + 1, classLevel, { min: 2, max: 4 });
    } else if (classLevel === 3) {
      k = generateConstrainedNumber(v, i, classLevel, { min: 2, max: 5 });
      pk = generateConstrainedNumber(v, i + 1, classLevel, { min: 2, max: 6 });
    } else if (classLevel === 4) {
      k = generateConstrainedNumber(v, i, classLevel, { min: 2, max: 6 });
      pk = generateConstrainedNumber(v, i + 1, classLevel, { min: 2, max: 8 });
    } else {
      k = 2 + ((v + i) % 4);
      pk = 3 + ((v + i) % 5);
    }
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

const generateDivisionEqualGrouping: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const objs = ['balls ⚽', 'stars ⭐', 'blocks 🧱', 'cards 🃏', 'buttons 🔘'];

  const sets = Array.from({ length: 5 }, (_, i) => {
    let pg: number;
    let g: number;
    if (classLevel === 2) {
      pg = generateConstrainedNumber(v, i, classLevel, { min: 2, max: 4 });
      g = generateConstrainedNumber(v, i + 1, classLevel, { min: 2, max: 4 });
    } else if (classLevel === 3) {
      pg = generateConstrainedNumber(v, i, classLevel, { min: 2, max: 5 });
      g = generateConstrainedNumber(v, i + 1, classLevel, { min: 2, max: 6 });
    } else if (classLevel === 4) {
      pg = generateConstrainedNumber(v, i, classLevel, { min: 2, max: 6 });
      g = generateConstrainedNumber(v, i + 1, classLevel, { min: 2, max: 8 });
    } else {
      pg = 3 + ((v + i) % 4);
      g = 2 + ((v + i) % 5);
    }
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

const generatePatterns: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
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
const generateDataHandling: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const items = [
    { a: 'apples 🍎', b: 'oranges 🍊' },
    { a: 'balloons 🎈', b: 'stars ⭐' },
    { a: 'books 📚', b: 'pencils ✏️' },
    { a: 'toys 🧸', b: 'blocks 🧱' },
    { a: 'cookies 🍪', b: 'candies 🍬' }
  ];
  const sets = Array.from({ length: 5 }, (_, i) => {
    const itemPair = items[(v + i) % items.length];
    let totalA: number;
    let totalB: number;
    if (classLevel <= 4) {
      totalA = generateConstrainedNumber(v, i, classLevel, { min: 5, max: 15 });
      totalB = generateConstrainedNumber(v, i + 1, classLevel, { min: 1, max: 4 });
    } else {
      totalA = 6 + ((v * 2 + i * 3) % 8); // 6 to 13
      totalB = 2 + ((v * 3 + i * 2) % 4); // 2 to 5
    }
    return {
      prompt: `${totalA} ${itemPair.a} vs ${totalB} ${itemPair.b}`,
      answer: String(totalA - totalB)
    };
  });
  return {
    question: "A pictograph chart shows two items. How many more of the first item than the second item are there?",
    subQuestions: sets,
    answer: "",
    topic: "Data Handling",
    aiGenerated: false,
    remediation: "Subtract the second quantity from the first quantity."
  };
};


const generateMoney: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    if (classLevel <= 4) {
      const cost = generateConstrainedNumber(v, i, classLevel, { min: 5, max: 45 });
      const paid = cost + generateConstrainedNumber(v, i + 1, classLevel, { min: 5, max: 15 });
      return { prompt: `Cost ₹${cost}, Paid ₹${paid}`, answer: `₹${paid - cost}` };
    }
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

const generateMeasurement: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
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

const generateUnitConversion: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    if (classLevel <= 4) {
      const m = generateConstrainedNumber(v, i, classLevel, { min: 2, max: 9 });
      return { prompt: `${m} m`, answer: `${m * 100} cm` };
    }
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

const generateTime: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
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


const generateAlgebra: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    let x: number;
    let y: number;
    if (classLevel <= 4) {
      x = generateConstrainedNumber(v, i, classLevel, { min: 2, max: 15 });
      y = generateConstrainedNumber(v, i + 1, classLevel, { min: 2, max: 15 });
    } else {
      x = (v + i) % 7 + 2;
      y = (v + i) % 9 + 3;
    }
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

const generateDecimals: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    let a: string;
    let b: string;
    if (classLevel <= 4) {
      a = (generateConstrainedNumber(v, i, classLevel, { min: 10, max: 80 }) / 10).toFixed(1);
      b = (generateConstrainedNumber(v, i + 1, classLevel, { min: 5, max: 20 }) / 10).toFixed(1);
    } else {
      a = ((v + i) % 9 + 1.2).toFixed(1);
      b = ((v + i) % 5 + 0.8).toFixed(1);
    }
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

const generatePercentages: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
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

const generateRatios: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    let boys: number;
    let girls: number;
    if (classLevel <= 4) {
      boys = generateConstrainedNumber(v, i, classLevel, { min: 2, max: 12 });
      girls = generateConstrainedNumber(v, i + 1, classLevel, { min: 2, max: 12 });
    } else {
      boys = (v + i) % 6 + 2;
      girls = (v + i) % 5 + 3;
    }
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

const generateIntegers: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
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

const generateStatistics: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    let scores: number[];
    if (classLevel <= 4) {
      const base = generateConstrainedNumber(v, i, classLevel, { min: 5, max: 25 });
      scores = [base, base + 2, base + 4, base + 6];
    } else {
      scores = [45, 50, 55, 60].map(s => s + v + i);
    }
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

const generateProbability: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
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

const generateWordProblems: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    let pens: number;
    let costPerPen: number;
    if (classLevel <= 4) {
      pens = generateConstrainedNumber(v, i, classLevel, { min: 2, max: 8 });
      costPerPen = generateConstrainedNumber(v, i + 1, classLevel, { min: 2, max: 6 });
    } else {
      pens = (v + i + 1) * 3;
      costPerPen = 5;
    }
    const cost = pens * costPerPen;
    return { prompt: `${pens} pens at ₹${costPerPen} each`, answer: `₹${cost}` };
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
const generateOrdinalNumbers: ConceptGenerator = (
  v,
  originalQ = '',
  originalAnswer = '',
  classLevel = 5
) => {
  const questionSets = [
    // SET 1
    [
      {
        prompt: "🐱 → 🐶 → 🐰 → 🐱 → 🐶 → ?",
        answer: "🐰"
      },
      {
        prompt: "🔴 → 🔵 → 🟢 → 🔴 → 🔵 → ?",
        answer: "🟢"
      },
      {
        prompt: "⭐ → 🌙 → ⭐ → 🌙 → ⭐ → ?",
        answer: "🌙"
      },
      {
        prompt: "🍎 → 🍌 → 🍊 → 🍎 → 🍌 → ?",
        answer: "🍊"
      },
      {
        prompt: "▲ → ■ → ● → ▲ → ■ → ?",
        answer: "●"
      }
    ],


    // SET 2
    [
      {
        prompt: "2 → 4 → 6 → 8 → 10 → ?",
        answer: "12"
      },
      {
        prompt: "5 → 10 → 15 → 20 → 25 → ?",
        answer: "30"
      },
      {
        prompt: "100 → 90 → 80 → 70 → 60 → ?",
        answer: "50"
      },
      {
        prompt: "3 → 6 → 9 → 12 → 15 → ?",
        answer: "18"
      },
      {
        prompt: "50 → 45 → 40 → 35 → 30 → ?",
        answer: "25"
      }
    ]
  ];

  // Alternate between the two sets
  const selectedSet = questionSets[v % questionSets.length];

  return {
    question: "Look at the pattern and identify what comes next:",

    subQuestions: selectedSet.map((q, index) => ({
      prompt: ` ${q.prompt}`,
      answer: q.answer
    })),

    answer: "",
    topic: "Patterns and Position",
    aiGenerated: false,
    remediation:
      "Look carefully at the sequence. Identify what changes or repeats, then use the same pattern to find the missing item."
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

const generateMatchTheTallies: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    let count: number;
    if (classLevel === 2) {
      count = generateConstrainedNumber(v, i, classLevel, { min: 2, max: 12 });
    } else if (classLevel <= 4) {
      count = generateConstrainedNumber(v, i, classLevel, { min: 2, max: 20 });
    } else {
      count = ((v + i) % 12) + 3;
    }
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

const generateAddAndMatch: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    let num1: number;
    let num2: number;
    if (classLevel <= 4) {
      num1 = generateConstrainedNumber(v, i, classLevel, { min: 1, max: 40 });
      num2 = generateConstrainedNumber(v, i + 1, classLevel, { min: 1, max: 40 });
    } else {
      num1 = (v + i + 1) * 4 + 3;
      num2 = (v + i + 1) * 3 + 5;
    }
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

const generateReadWriteDecimals: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
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


const generateCompareDecimals: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
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


const generateDecimalsInMoney: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    let cost: number;
    let paid: number;
    if (classLevel <= 4) {
      cost = parseFloat((generateConstrainedNumber(v, i, classLevel, { min: 100, max: 990 }) / 100).toFixed(2));
      paid = Math.ceil(cost / 10) * 10;
    } else {
      cost = 12.50 + v + i;
      paid = 20.00;
    }
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

const generateWritePosition: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
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

const generateIdentifyPosition: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
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
      prompt: `${expr} = ___`,
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
const generateAdditionObjects: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
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

const generateNumberSensePlaceValue: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    let num: number;
    if (classLevel === 2) {
      num = generateConstrainedNumber(v, i, classLevel, { min: 10, max: 50 });
    } else {
      num = generateConstrainedNumber(v, i, classLevel, { min: 10, max: 99 });
    }
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

const generateGeometryPerimeter: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    const side = generateConstrainedNumber(v, i, classLevel, { min: 2, max: 12 });
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


const generateGeometryAngles: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
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

const generateSubtractionObjects: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
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

const generateHowManyPlaceValue: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
  const sets = Array.from({ length: 5 }, (_, i) => {
    let num: number;
    if (classLevel === 2) {
      num = generateConstrainedNumber(v, i, classLevel, { min: 10, max: 50 });
    } else {
      num = generateConstrainedNumber(v, i, classLevel, { min: 10, max: 99 });
    }
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

const generateNumberSenseComparison: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
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

const generateNumberSenseCounting: ConceptGenerator = (v, originalQ = '', originalAnswer = '', classLevel = 5) => {
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

const generateMissingNumbers: ConceptGenerator = (v, originalQ = '') => {
  const seed = v + (originalQ.length);
  const sets = Array.from({ length: 5 }, (_, i) => {
    const s = seed + i;
    const step = (s % 5) + 2;
    const start = 2 + (s % 10) * step;
    const seq = [start, start + step, start + 2 * step, start + 3 * step, start + 4 * step];
    const answer = seq[2];
    seq[2] = '__' as any;
    return { prompt: `${seq.join(', ')} (skip count by ${step}s)`, answer: String(answer) };
  });
  return { question: "Fill the missing numbers:", subQuestions: sets, answer: "", topic: "Missing Numbers", aiGenerated: false };
};

const generateNumberOfSides: ConceptGenerator = (v, originalQ = '') => {
  const seed = v + (originalQ.length);
  const sets = Array.from({ length: 5 }, (_, i) => {
    const s = seed + i;
    const shapes = [
      { name: 'Triangle', sides: 3 },
      { name: 'Square', sides: 4 },
      { name: 'Rectangle', sides: 4 },
      { name: 'Pentagon', sides: 5 },
      { name: 'Hexagon', sides: 6 }
    ];
    const shape = shapes[s % shapes.length];
    return { prompt: `A ${shape.name} has ___ sides.`, answer: String(shape.sides) };
  });
  return { question: "Answer the following shape questions:", subQuestions: sets, answer: "", topic: "Number of Sides", aiGenerated: false };
};

const generateAscendingOrder: ConceptGenerator = (v, originalQ = '') => {
  const seed = v + (originalQ.length);
  const sets = Array.from({ length: 5 }, (_, i) => {
    const s = seed + i;
    const nums = [12 + (s % 10) * 2, 8 + (s % 15) * 3, 25 + (s % 12), 15 + (s % 8) * 4];
    const sorted = [...nums].sort((a, b) => a - b);
    return { prompt: `Sort Ascending: ${nums.join(', ')} -> ___`, answer: sorted.join(', ') };
  });
  return { question: "Arrange the following numbers in ascending order (smallest to largest):", subQuestions: sets, answer: "", topic: "Ascending Order", aiGenerated: false };
};

const generateDescendingOrder: ConceptGenerator = (v, originalQ = '') => {
  const seed = v + (originalQ.length);
  const sets = Array.from({ length: 5 }, (_, i) => {
    const s = seed + i;
    const nums = [14 + (s % 10) * 2, 9 + (s % 15) * 3, 30 + (s % 12), 20 + (s % 8) * 4];
    const sorted = [...nums].sort((a, b) => b - a);
    return { prompt: `Sort Descending: ${nums.join(', ')} -> ___`, answer: sorted.join(', ') };
  });
  return { question: "Arrange the following numbers in descending order (largest to smallest):", subQuestions: sets, answer: "", topic: "Descending Order", aiGenerated: false };
};

const generateTensAndOnes: ConceptGenerator = (v, originalQ = '') => {
  const seed = v + (originalQ.length);
  const sets = Array.from({ length: 5 }, (_, i) => {
    const s = seed + i;
    const tens = (s % 8) + 2;
    const ones = ((s * 7) % 9) + 1;
    const num = tens * 10 + ones;
    if (s % 2 === 0) {
      return { prompt: `The tens digit in ${num} is ___`, answer: String(tens) };
    } else {
      return { prompt: `${num} = ___ tens and ___ ones`, answer: `${tens} tens and ${ones} ones` };
    }
  });
  return { question: "Answer the following place value questions:", subQuestions: sets, answer: "", topic: "Tens and Ones", aiGenerated: false };
};

const generateDataCollection: ConceptGenerator = (v, originalQ = '') => {
  const seed = v + (originalQ.length);
  const sets = Array.from({ length: 5 }, (_, i) => {
    const s = seed + i;
    const item1 = ['red cars', 'apples', 'cats', 'blue pens', 'chairs'][s % 5];
    const item2 = ['blue cars', 'bananas', 'dogs', 'black pens', 'tables'][s % 5];
    const count1 = (s % 10) + 3;
    const count2 = ((s * 13) % 8) + 4;
    return { prompt: `${count1} ${item1} and ${count2} ${item2}. Total items = ___`, answer: String(count1 + count2) };
  });
  return { question: "Read the data and answer:", subQuestions: sets, answer: "", topic: "Data Collection", aiGenerated: false };
};

const GENERATORS: Record<string, ConceptGenerator> = {
  'missing': generateMissingNumbers,
  'missing numbers': generateMissingNumbers,
  'missing number': generateMissingNumbers,
  'fill in missing numbers': generateMissingNumbers,
  'fill in missing number': generateMissingNumbers,
  'number of sides': generateNumberOfSides,
  'number of side': generateNumberOfSides,
  'ascending order': generateAscendingOrder,
  'descending order': generateDescendingOrder,
  'tens and ones': generateTensAndOnes,
  'data collection': generateDataCollection,

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
  originalAnswer: string = '',
  classLevel: number = 5
): BlueprintQuestion {
  const result = _generateByConcept(concept, variantIndex, originalQ, originalAnswer, classLevel);
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
  originalAnswer: string = '',
  classLevel: number = 5
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
    return generateUnderlinedPlaceValue(variantIndex, originalQ, originalAnswer, classLevel);
  }

  // ── OTHER REGISTERED GENERATORS ───────────────────────────
  if (c === 'matchfingerstofruits' || c.replace(/\s+/g, '') === 'matchfingerstofruits') {
    return generateMatchFingersToFruits(variantIndex, originalQ, originalAnswer, classLevel);
  }
  if (c === 'add and match' || c.replace(/\s+/g, '') === 'addandmatch') {
    return generateAddAndMatch(variantIndex, originalQ, originalAnswer, classLevel);
  }
  if (c === 'match the tallies' || c.includes('tally') || c.replace(/\s+/g, '') === 'matchthetallies') {
    return generateMatchTheTallies(variantIndex, originalQ, originalAnswer, classLevel);
  }

  const gen = GENERATORS[c] || GENERATORS[c.replace(/\s+/g, '')];
  if (gen) return gen(variantIndex, originalQ, originalAnswer, classLevel);

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
  baseOffset: number = 0,
  classLevel: number = 5
): BlueprintQuestion[] {
  const cleanQ = sanitizeQuestionText(originalQ);
  const concept = detectConcept(cleanQ, hintConcept);

  const firstVariant = generateByConcept(concept, baseOffset, cleanQ, originalAnswer, classLevel);

  // If the concept generator returned a subQuestions array (1 instruction + 5 sub-questions),
  // return that single structured object instead of duplicating it 5 times!
  if (firstVariant.subQuestions && Array.isArray(firstVariant.subQuestions) && firstVariant.subQuestions.length > 0) {
    return [firstVariant];
  }

  return Array.from({ length: count }, (_, i) => {
    const variant = generateByConcept(concept, baseOffset + i, cleanQ, originalAnswer, classLevel);

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
    variantIndex: number = 0,
    classLevel: number = 5
  ): BlueprintQuestion {

    let originalQStr = '';
    if (typeof originalQuestion === 'string') {
      originalQStr = originalQuestion;
    } else if (originalQuestion && typeof originalQuestion === 'object') {
      const obj = originalQuestion as any;
      originalQStr = obj.question || obj.questionText || obj.text || obj.prompt || obj.content || JSON.stringify(obj);
    } else {
      originalQStr = String(originalQuestion || '');
    }

    let cleanQ = originalQStr
      .replace(/[\s—–-]*Item\s*\d+/gi, '')
      .replace(/[\s—–-]*Question\s*\d+/gi, '')
      .replace(/^Question\s*\d+\s*:\s*/i, '')
      .trim();

    if (!cleanQ) cleanQ = `${conceptName || 'Mathematics'} Question`;

    // ── 2. Concept Detection + Concept Generator ────────────────────────────────
    // Auto-detect concept from question text, then route to the right generator.
    const concept = detectConcept(cleanQ, conceptName);
    const generated = generateByConcept(concept, variantIndex, cleanQ, originalAnswer, classLevel);

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
        let newNum = origNum;
        if (classLevel <= 4) {
          if (origNum >= 100) {
            newNum = generateConstrainedNumber(variantIndex, i, classLevel, { min: 100, is3DigitPlaceValue: true, step: 23 });
          } else if (origNum >= 10) {
            newNum = generateConstrainedNumber(variantIndex, i, classLevel, { min: 10, max: 90, step: 7 });
          } else {
            newNum = generateConstrainedNumber(variantIndex, i, classLevel, { min: 2, max: 9, step: 1 });
          }
        } else {
          const step = (variantIndex + 1) * (i + 1) * (origNum > 50 ? 5 : 2);
          newNum = Math.max(1, origNum + (variantIndex % 2 === 0 ? step : -Math.min(step - 1, origNum - 1)));
        }
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
    let v1 = (variantIndex + 1) * 7 + 12;
    let v2 = (variantIndex + 1) * 4 + 8;
    if (classLevel <= 4) {
      v1 = generateConstrainedNumber(variantIndex, 0, classLevel, { min: 10, max: 50, step: 3 });
      v2 = generateConstrainedNumber(variantIndex, 1, classLevel, { min: 5, max: 20, step: 2 });
    }

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