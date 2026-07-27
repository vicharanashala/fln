import { Question } from './db';

let currentPRNG: (() => number) | null = null;

export function setQuestionPRNG(seedStr?: string) {
  if (!seedStr) {
    currentPRNG = null;
    return;
  }
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  }
  currentPRNG = function() {
    h += h << 13; h ^= h >>> 7;
    h += h << 3;  h ^= h >>> 17;
    return ((h += h << 5) >>> 0) / 4294967296;
  };
}

// Helper to generate a random integer
function randomVal(min: number, max: number): number {
  const rand = currentPRNG ? currentPRNG() : Math.random();
  return Math.floor(rand * (max - min + 1)) + min;
}

// Programmatic math builder for all 59 levels and 3 sub-levels
export function generateQuestionsForLevel(level: number, subLevel: number, seedStr?: string): Question[] {
  if (seedStr) {
    setQuestionPRNG(seedStr);
  }
  try {
    const questions: Question[] = [];
    const levelStr = `L${level}.${subLevel}`;

  // Helper to adjust range based on subLevel
  // subLevel 0 = Mastery (full range), 1 = Easier (mid range), 2 = Remedial (simplest/visual)
  const adjust = (val0: number, val1: number, val2: number): number => {
    if (subLevel === 2) return val2;
    if (subLevel === 1) return val1;
    return val0;
  };

  const getSubTopic = (): string => {
    return subLevel === 2 ? 'Remedial' : subLevel === 1 ? 'Easier' : 'Mastery';
  };

  // Build 4 questions per level
  for (let qIdx = 1; qIdx <= 4; qIdx++) {
    const questionId = `${levelStr}_Q${qIdx}`;
    let questionText = '';
    let answerText = '';
    let type: 'number' | 'text' | 'choice' = 'number';
    let choices: string[] | undefined = undefined;
    let topic = 'Number Sense';
    let subtopic = getSubTopic();
    let svgAsset: string | undefined = undefined;

    // Determine strand/topic based on level
    if ([3, 52, 58].includes(level)) {
      topic = 'Shapes';
    } else if ([9].includes(level)) {
      topic = 'Patterns';
    } else if ([7, 8, 16, 17, 26, 27, 33, 39, 40, 41, 42, 50, 51, 53].includes(level)) {
      topic = 'Number Operations';
    } else if ([31, 44].includes(level)) {
      topic = 'Calendar & Time';
    } else if ([45, 54].includes(level)) {
      topic = 'Fractions';
    } else if ([46].includes(level)) {
      topic = 'Money';
    } else if ([34, 43, 56, 57].includes(level)) {
      topic = 'Measurement';
    } else if ([30, 47].includes(level)) {
      topic = 'Data Handling';
    }

    // Level-specific question builders
    switch (level) {
      // --- Preschool 1 (Levels 1-3) ---
      case 1:
        topic = 'Number Sense';
        if (qIdx === 1) {
          const numA = adjust(randomVal(7, 9), randomVal(4, 6), randomVal(2, 3));
          const numB = adjust(randomVal(3, 5), randomVal(2, 3), 1);
          questionText = `Group A has ${numA} balls. Group B has ${numB} balls. Which group has MORE balls? (Write A or B)`;
          answerText = numA > numB ? 'A' : 'B';
          type = 'choice';
          choices = ['A', 'B'];
        } else if (qIdx === 2) {
          const numA = adjust(randomVal(3, 4), randomVal(2, 3), 1);
          const numB = adjust(randomVal(6, 8), randomVal(4, 5), randomVal(2, 3));
          questionText = `Group A has ${numA} stars. Group B has ${numB} stars. Which group has LESS stars? (Write A or B)`;
          answerText = numA < numB ? 'A' : 'B';
          type = 'choice';
          choices = ['A', 'B'];
        } else {
          const valA = randomVal(4, 8);
          const valB = randomVal(1, valA - 1);
          questionText = `Is ${valA} greater than ${valB}? (Write Yes or No)`;
          answerText = 'yes';
          type = 'choice';
          choices = ['yes', 'no'];
        }
        svgAsset = 'fruits';
        break;

      case 2:
        topic = 'Number Sense';
        const oddSets = [
          { items: '[Circle, Triangle, Apple, Square]', answer: 'apple' },
          { items: '[Cat, Dog, Banana, Cow]', answer: 'banana' },
          { items: '[Red, Blue, Chair, Green]', answer: 'chair' },
          { items: '[1, 2, Star, 4]', answer: 'star' }
        ];
        const chosenOdd = oddSets[(qIdx - 1) % oddSets.length];
        questionText = `Find the ODD one out in this list: ${chosenOdd.items}. (Write the odd item name)`;
        answerText = chosenOdd.answer;
        type = 'text';
        break;

      case 3:
        topic = 'Shapes';
        const shapesList = ['square', 'circle', 'triangle', 'rectangle'];
        const targetShape = shapesList[(qIdx + randomVal(0, 3)) % shapesList.length];
        questionText = `Match the shapes: If shape A is a ${targetShape}, which identical shape matches A? (Write ${targetShape})`;
        answerText = targetShape;
        type = 'text';
        break;

      // --- Preschool 2 (Levels 4-6) ---
      case 4:
        topic = 'Number Sense';
        const stars = adjust(randomVal(7, 10), randomVal(4, 6), randomVal(1, 3));
        questionText = `Count the stars: ${Array(stars).fill('*').join(' ')}. How many are there?`;
        answerText = String(stars);
        break;

      case 5:
        topic = 'Number Sense';
        const fingers = adjust(randomVal(4, 5), randomVal(2, 3), 1);
        questionText = `Count the fingers shown in gesture: [Hand showing ${fingers} fingers]. How many?`;
        answerText = String(fingers);
        break;

      case 6:
        topic = 'Number Sense';
        const num = adjust(randomVal(7, 9), randomVal(4, 6), randomVal(2, 3));
        if (qIdx === 1) {
          questionText = `What number comes AFTER ${num}?`;
          answerText = String(num + 1);
        } else if (qIdx === 2) {
          questionText = `What number comes BEFORE ${num}?`;
          answerText = String(num - 1);
        } else {
          questionText = `What number is BETWEEN ${num - 1} and ${num + 1}?`;
          answerText = String(num);
        }
        break;

      // --- Preschool 3 (Levels 7-10) ---
      case 7:
        topic = 'Number Operations';
        const addA = adjust(randomVal(4, 6), randomVal(2, 4), randomVal(1, 2));
        const addB = adjust(randomVal(3, 4), randomVal(1, 2), 1);
        questionText = `Add using objects: ${addA} apples + ${addB} apples = How many apples in total?`;
        answerText = String(addA + addB);
        break;

      case 8:
        topic = 'Number Operations';
        const subA = adjust(randomVal(8, 10), randomVal(5, 7), randomVal(3, 4));
        const subB = adjust(randomVal(3, 4), randomVal(2, 3), 1);
        questionText = `Subtract using objects: ${subA} balloons minus ${subB} balloons. How many left?`;
        answerText = String(subA - subB);
        break;

      case 9:
        topic = 'Patterns';
        const patterns = [
          { seq: 'Circle, Triangle, Circle, Triangle, ___', ans: 'circle', opts: ['circle', 'triangle'] },
          { seq: 'Square, Star, Square, Star, ___', ans: 'square', opts: ['square', 'star'] },
          { seq: 'Red, Blue, Red, Blue, ___', ans: 'red', opts: ['red', 'blue'] },
          { seq: '1, 2, 1, 2, ___', ans: '1', opts: ['1', '2'] }
        ];
        const pat = patterns[(qIdx - 1) % patterns.length];
        questionText = `Complete the pattern: ${pat.seq}. (Write ${pat.opts.join(' or ')})`;
        answerText = pat.ans;
        type = 'choice';
        choices = pat.opts;
        break;

      case 10:
        topic = 'Number Sense';
        const cmpA = adjust(randomVal(7, 9), randomVal(5, 6), randomVal(3, 4));
        const cmpB = adjust(randomVal(3, 5), randomVal(2, 4), randomVal(1, 2));
        questionText = `Which numeral is bigger: ${cmpA} or ${cmpB}?`;
        answerText = String(Math.max(cmpA, cmpB));
        break;

      // --- Class 1 (Levels 12-22) ---
      case 12:
        topic = 'Number Sense';
        const val12 = adjust(25, 18, 12);
        if (qIdx === 1) {
          questionText = `How many tens are in the number ${val12}?`;
          answerText = String(Math.floor(val12 / 10));
        } else {
          questionText = `How many ones are in the number ${val12}?`;
          answerText = String(val12 % 10);
        }
        break;

      case 13:
        topic = 'Number Sense';
        const val13 = adjust(randomVal(20, 30), randomVal(15, 20), randomVal(11, 14));
        questionText = `What number is represented by ${Math.floor(val13 / 10)} tens and ${val13 % 10} ones?`;
        answerText = String(val13);
        break;

      case 14:
        topic = 'Number Sense';
        const wordNum = adjust(15, 20, 12);
        questionText = `Write the numeral for ${wordNum === 15 ? 'fifteen' : wordNum === 20 ? 'twenty' : 'twelve'}:`;
        answerText = String(wordNum);
        break;

      case 15:
        topic = 'Number Sense';
        const val15 = adjust(28, 19, 14);
        questionText = `What number comes between ${val15 - 1} and ${val15 + 1}?`;
        answerText = String(val15);
        break;

      case 16:
        topic = 'Number Operations';
        const add16A = adjust(randomVal(12, 18), randomVal(8, 12), randomVal(4, 7)) + (qIdx * 2);
        const add16B = adjust(randomVal(5, 8), randomVal(3, 5), randomVal(1, 3)) + qIdx;
        questionText = `Solve: ${add16A} + ${add16B} = ?`;
        answerText = String(add16A + add16B);
        break;

      case 17:
        const sub17A = adjust(randomVal(25, 30), randomVal(15, 20), randomVal(10, 14));
        const sub17B = adjust(randomVal(8, 10), randomVal(4, 7), randomVal(2, 4));
        questionText = `Solve: ${sub17A} - ${sub17B} = ?`;
        answerText = String(sub17A - sub17B);
        break;

      case 18:
        topic = 'Number Sense';
        questionText = `Arrange in ascending (increasing) order: [25, 12, 19]. (Write lowest number first, e.g. 12)`;
        answerText = '12';
        break;

      case 19:
        topic = 'Number Sense';
        const val19 = adjust(45, 38, 32);
        questionText = `How many tens are in the number ${val19}?`;
        answerText = String(Math.floor(val19 / 10));
        break;

      case 20:
        topic = 'Number Sense';
        const step20 = adjust(5, 3, 2);
        questionText = `Skip count by ${step20}s: ${step20}, ${step20 * 2}, ${step20 * 3}, ___. What is next?`;
        answerText = String(step20 * 4);
        break;

      case 21:
        topic = 'Number Sense';
        const cmp21A = adjust(48, 35, 12);
        const cmp21B = adjust(42, 38, 15);
        questionText = `Compare numbers: Is ${cmp21A} greater than ${cmp21B}? (Write Yes or No)`;
        answerText = cmp21A > cmp21B ? 'yes' : 'no';
        type = 'choice';
        choices = ['yes', 'no'];
        break;

      case 22:
        topic = 'Number Sense';
        questionText = `Arrange in descending (decreasing) order: [32, 48, 15]. (Write largest number first, e.g. 48)`;
        answerText = '48';
        break;

      // --- Class 2 (Levels 24-34) ---
      case 24:
        topic = 'Number Sense';
        const val24 = adjust(87, 65, 52);
        questionText = `Write the numeral for ${val24 === 87 ? 'eighty seven' : val24 === 65 ? 'sixty five' : 'fifty two'}:`;
        answerText = String(val24);
        break;

      case 25:
        topic = 'Number Sense';
        const val25 = adjust(94, 76, 58);
        questionText = `What is the place value of the digit ${Math.floor(val25 / 10)} in the number ${val25}? (Write 50, 70, or 90)`;
        answerText = String(Math.floor(val25 / 10) * 10);
        break;

      case 26:
        const add26A = adjust(randomVal(45, 65), randomVal(30, 44), randomVal(15, 29));
        const add26B = adjust(randomVal(28, 35), randomVal(15, 27), randomVal(5, 14));
        questionText = `Carry Addition: Solve ${add26A} + ${add26B} = ?`;
        answerText = String(add26A + add26B);
        break;

      case 27:
        const sub27A = adjust(randomVal(72, 95), randomVal(50, 71), randomVal(30, 49));
        const sub27B = adjust(randomVal(38, 49), randomVal(20, 37), randomVal(11, 19));
        questionText = `Borrow Subtraction: Solve ${sub27A} - ${sub27B} = ?`;
        answerText = String(sub27A - sub27B);
        break;

      case 28:
        topic = 'Number Sense';
        const val28A = adjust(92, 75, 56);
        const val28B = adjust(89, 78, 62);
        questionText = `Which symbol goes in the box to make it correct: ${val28A} [>] [?] [<] ${val28B}? (Write > or <)`;
        answerText = val28A > val28B ? '>' : '<';
        type = 'choice';
        choices = ['>', '<'];
        break;

      case 29:
        topic = 'Number Sense';
        questionText = `Arrange in ascending order: [74, 91, 58]. (Write lowest number first, e.g. 58)`;
        answerText = '58';
        break;

      case 30:
        questionText = `Write the number represented by tally marks |||| | (5 and 1):`;
        answerText = '6';
        break;

      case 31:
        questionText = `If the short hour hand is at 4 and the long minute hand is at 12, what time is it? (Write 4:00)`;
        answerText = '4:00';
        break;

      case 32:
        topic = 'Number Sense';
        questionText = `In the word 'APPLE', which letter is in the 3rd (third) position?`;
        answerText = 'p';
        type = 'text';
        break;

      case 33:
        const mult33 = adjust(4, 3, 2);
        questionText = `Repeated addition: 3 + 3 + 3 + 3 is the same as ${mult33} groups of 3. What is the total?`;
        answerText = String(mult33 * 3);
        break;

      case 34:
        questionText = `If one pencil is 5 paperclips long, how many paperclips long are 2 pencils?`;
        answerText = '10';
        break;

      // --- Class 3 (Levels 36-47) ---
      case 36:
        topic = 'Number Sense';
        const val36 = adjust(452, 235, 128);
        questionText = `What number is equal to ${Math.floor(val36 / 100)} hundreds, ${Math.floor((val36 % 100) / 10)} tens, and ${val36 % 10} ones?`;
        answerText = String(val36);
        break;

      case 37:
        topic = 'Number Sense';
        const val37A = adjust(634, 432, 215);
        const val37B = adjust(643, 423, 251);
        questionText = `Which is smaller: ${val37A} or ${val37B}?`;
        answerText = String(Math.min(val37A, val37B));
        break;

      case 38:
        topic = 'Number Sense';
        questionText = `Arrange in descending order: [432, 756, 128]. (Write largest number first, e.g. 756)`;
        answerText = '756';
        break;

      case 39:
        const add39A = adjust(456, 234, 123);
        const add39B = adjust(238, 142, 54);
        questionText = `Solve: ${add39A} + ${add39B} = ?`;
        answerText = String(add39A + add39B);
        break;

      case 40:
        const sub40A = adjust(785, 456, 234);
        const sub40B = adjust(296, 148, 89);
        questionText = `Solve: ${sub40A} - ${sub40B} = ?`;
        answerText = String(sub40A - sub40B);
        break;

      case 41:
        const multA = adjust(7, 5, 3);
        const multB = adjust(8, 6, 4);
        questionText = `What is ${multA} times ${multB}?`;
        answerText = String(multA * multB);
        break;

      case 42:
        const divA = adjust(24, 12, 6);
        const divB = adjust(4, 3, 2);
        questionText = `Divide: ${divA} items shared equally among ${divB} children. How many each?`;
        answerText = String(divA / divB);
        break;

      case 43:
        const m = adjust(5, 3, 2);
        questionText = `Convert standard measurement: How many centimeters are in ${m} meters? (Hint: 1m = 100cm)`;
        answerText = String(m * 100);
        break;

      case 44:
        questionText = `How many months are in a standard calendar year?`;
        answerText = '12';
        break;

      case 45:
        questionText = `If a pizza is divided into 4 equal slices and Rahul eats 1 slice, what fraction of the pizza did Rahul eat? (Write 1/4)`;
        answerText = '1/4';
        type = 'text';
        break;

      case 46:
        const coins = adjust(5, 3, 2);
        questionText = `How many 10-rupee coins do you need to make ${coins * 10} rupees?`;
        answerText = String(coins);
        break;

      case 47:
        questionText = `If Class A has 5 boys and 7 girls, how many total students are in Class A?`;
        answerText = '12';
        break;

      // --- Class 4 (Levels 49-58) ---
      case 49:
        topic = 'Number Sense';
        const val49 = adjust(7482, 3450, 1205);
        questionText = `What is the place value of the digit ${Math.floor(val49 / 1000)} in the number ${val49}? (e.g. 7000)`;
        answerText = String(Math.floor(val49 / 1000) * 1000);
        break;

      case 50:
        const m50A = adjust(45, 25, 12);
        const m50B = adjust(12, 10, 5);
        questionText = `Solve: ${m50A} × ${m50B} = ?`;
        answerText = String(m50A * m50B);
        break;

      case 51:
        const d51A = adjust(125, 75, 45);
        const d51B = adjust(5, 5, 3);
        questionText = `Solve: ${d51A} ÷ ${d51B} = ?`;
        answerText = String(d51A / d51B);
        break;

      case 52:
        questionText = `If you face NORTH and make a quarter turn clockwise (right), which direction will you face? (East, West, South)`;
        answerText = 'east';
        type = 'choice';
        choices = ['east', 'west', 'south'];
        break;

      case 53:
        const val53 = adjust(6, 4, 3);
        questionText = `Find the smallest positive multiple of ${val53}:`;
        answerText = String(val53);
        break;

      case 54:
        questionText = `Add the fractions: 1/5 + 2/5 = ? (Write 3/5)`;
        answerText = '3/5';
        type = 'text';
        break;

      case 55:
        topic = 'Number Sense';
        questionText = `Write the fraction 3/10 as a decimal number: (Write 0.3)`;
        answerText = '0.3';
        type = 'text';
        break;

      case 56:
        const side = adjust(6, 5, 4);
        questionText = `What is the perimeter of a square with a side length of ${side} cm?`;
        answerText = String(side * 4);
        break;

      case 57:
        questionText = `An angle that measures exactly 90 degrees is called a ___ angle. (Right, Acute, Obtuse)`;
        answerText = 'right';
        type = 'choice';
        choices = ['right', 'acute', 'obtuse'];
        break;

      case 58:
        questionText = `How many lines of symmetry does a standard square have?`;
        answerText = '4';
        break;

      // --- Fallback / Review Assessments ---
      case 11:
      case 23:
      case 35:
      case 48:
      case 59:
      default:
        topic = 'Number Sense';
        const reviewAddA = adjust(12, 8, 4);
        const reviewAddB = adjust(5, 3, 2);
        questionText = `Review Assessment: What is ${reviewAddA} + ${reviewAddB}?`;
        answerText = String(reviewAddA + reviewAddB);
        break;
    }

    questions.push({
      question_id: questionId,
      question: questionText,
      answer: answerText,
      answer_type: type,
      choices,
      topic,
      subtopic,
      difficulty: qIdx <= 2 ? 'easy' : qIdx === 3 ? 'medium' : 'hard',
      source_level: level,
      });
  }
  return questions;
} finally {
  if (seedStr) setQuestionPRNG();
}
}

export function generateMultiTopicQuestions(targetLevel: number, subLevel: number, count: number = 4, seedStr?: string): Question[] {
  const selectedQuestions: Question[] = [];
  const coveredTopics = new Set<string>();
  
  const getIndex = (str: string, max: number): number => {
    if (!seedStr) return Math.floor(Math.random() * max);
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i) | 0;
    return Math.abs(hash) % max;
  };

  let offset = 0;
  // We want questions from distinct topics, starting from targetLevel and going down
  for (let lvl = targetLevel; lvl >= 1 && selectedQuestions.length < count; lvl--) {
    const levelQs = generateQuestionsForLevel(lvl, subLevel);
    if (levelQs.length > 0) {
      const topic = levelQs[0].topic.toLowerCase();
      if (!coveredTopics.has(topic)) {
        coveredTopics.add(topic);
        const idx = getIndex(`${seedStr}_L${lvl}_${offset++}`, levelQs.length);
        const selectedQ = levelQs[idx];
        selectedQuestions.push(selectedQ);
      }
    }
  }

  // If we couldn't find enough distinct topics, fill the rest from the generated levels
  if (selectedQuestions.length < count) {
    for (let lvl = targetLevel; lvl >= 1 && selectedQuestions.length < count; lvl--) {
      const fillQs = generateQuestionsForLevel(lvl, subLevel);
      for (const q of fillQs) {
        if (selectedQuestions.length >= count) break;
        if (!selectedQuestions.some(sq => sq.question === q.question)) {
          selectedQuestions.push(q);
        }
      }
    }
  }

  return selectedQuestions;
}
