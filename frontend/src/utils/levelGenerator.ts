import { Question } from '../types';

// Helper to generate a random integer
function randomVal(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper to pick a qIdx-specific variant from a small pool so that a paper
// never contains four identical questions even when the level template is fixed.
// Curriculum content (the competency and the answer type) is unchanged; only
// the parameters used in the question vary per qIdx.
function pick<T>(qIdx: number, options: T[]): T {
  return options[Math.min(qIdx - 1, options.length - 1)];
}

// Programmatic math builder for all 59 levels and 3 sub-levels
export function generateQuestionsForLevel(level: number, subLevel: number): Question[] {
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
    if ([3, 9, 52, 58].includes(level)) {
      topic = 'Shapes';
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
      case 1: {
        topic = 'Number Sense';
        const c1 = pick(qIdx, [
          { kind: 'MORE', a: 8, b: 3, ans: 'A' },
          { kind: 'LESS', a: 8, b: 3, ans: 'B' },
          { kind: 'GT',  a: 7, b: 3, ans: 'yes' },
          { kind: 'LT',  a: 7, b: 3, ans: 'no' }
        ]);
        if (c1.kind === 'MORE') {
          questionText = `Group A has ${c1.a} items. Group B has ${c1.b} items. Which group has MORE? (Write A or B)`;
          answerText = 'A';
          choices = ['A', 'B'];
        } else if (c1.kind === 'LESS') {
          questionText = `Group A has ${c1.a} items. Group B has ${c1.b} items. Which group has LESS? (Write A or B)`;
          answerText = 'B';
          choices = ['A', 'B'];
        } else if (c1.kind === 'GT') {
          questionText = `Is ${c1.a} greater than ${c1.b}? (Write Yes or No)`;
          answerText = 'yes';
          choices = ['yes', 'no'];
        } else {
          questionText = `Is ${c1.a} less than ${c1.b}? (Write Yes or No)`;
          answerText = 'no';
          choices = ['yes', 'no'];
        }
        type = 'choice';
        svgAsset = 'fruits';
        break;
      }

      case 2: {
        topic = 'Number Sense';
        const c2 = pick(qIdx, [
          { items: ['Circle','Triangle','Apple','Square'], odd: 2, ans: 'Apple' },
          { items: ['Dog','Cat','Car','Fish'], odd: 2, ans: 'Car' },
          { items: ['Red','Blue','Circle','Green'], odd: 2, ans: 'Green' },
          { items: ['Sun','Moon','Star','Star'], odd: 1, ans: 'Moon' }
        ]);
        questionText = `Find the ODD one out in this list: [${c2.items.join(', ')}]. (Write the odd item name)`;
        answerText = c2.ans;
        type = 'text';
        break;
      }

      case 3:
        const shape3 = pick(qIdx, ['square', 'circle', 'triangle', 'rectangle']);
        questionText = `Match the shapes: If shape A is a ${shape3}, which identical shape matches A? (Write ${shape3})`;
        answerText = shape3;
        type = 'text';
        break;

      // --- Preschool 2 (Levels 4-6) ---
      case 4: {
        topic = 'Number Sense';
        const stars = pick(qIdx, [8, 9, 10, 7]);
        questionText = `Count the stars: ${Array(stars).fill('★').join(' ')}. How many are there?`;
        answerText = String(stars);
        break;
      }

      case 5: {
        topic = 'Number Sense';
        const fingers = pick(qIdx, [3, 4, 5, 2]);
        questionText = `Count the fingers shown in gesture: [🖐️ showing ${fingers} fingers]. How many?`;
        answerText = String(fingers);
        break;
      }

      case 6: {
        topic = 'Number Sense';
        const c6 = pick(qIdx, [
          { kind: 'AFTER', val: 8, ans: 9 },
          { kind: 'BEFORE', val: 8, ans: 7 },
          { kind: 'BETWEEN', lo: 3, hi: 5, ans: 4 },
          { kind: 'BIGGER', a: 5, b: 8, ans: 8 }
        ]);
        if (c6.kind === 'AFTER') {
          questionText = `What number comes AFTER ${c6.val}?`;
          answerText = String(c6.ans);
        } else if (c6.kind === 'BEFORE') {
          questionText = `What number comes BEFORE ${c6.val}?`;
          answerText = String(c6.ans);
        } else if (c6.kind === 'BETWEEN') {
          questionText = `What number is BETWEEN ${c6.lo} and ${c6.hi}?`;
          answerText = String(c6.ans);
        } else {
          questionText = `Which is bigger: ${c6.a} or ${c6.b}? (Write the bigger number)`;
          answerText = String(c6.ans);
          type = 'text';
        }
        break;
      }

      // --- Preschool 3 (Levels 7-10) ---
      case 7: {
        const addConfigs7 = pick(qIdx, [
          { a: 6, b: 1 },
          { a: 7, b: 3 },
          { a: 5, b: 6 },
          { a: 4, b: 8 }
        ]);
        questionText = `Add using objects: ${Array(addConfigs7.a).fill('🍎').join('')} + ${Array(addConfigs7.b).fill('🍎').join('')} = How many apples in total?`;
        answerText = String(addConfigs7.a + addConfigs7.b);
        break;
      }

      case 8: {
        const subConfigs8 = pick(qIdx, [
          { a: 9, b: 1 },
          { a: 10, b: 4 },
          { a: 12, b: 7 },
          { a: 15, b: 11 }
        ]);
        questionText = `Subtract using objects: ${Array(subConfigs8.a).fill('🎈').join('')} minus ${subConfigs8.b} balloons. How many left?`;
        answerText = String(subConfigs8.a - subConfigs8.b);
        break;
      }

      case 9:
        const patterns9 = pick(qIdx, [
          ['Circle', 'Triangle', 'Circle', 'Triangle'],
          ['Red', 'Blue', 'Red', 'Blue'],
          ['Star', 'Heart', 'Star', 'Heart'],
          ['Up', 'Down', 'Up', 'Down']
        ]);
        const patternAns9 = patterns9[0].toLowerCase();
        questionText = `Complete the pattern: ${patterns9[0]}, ${patterns9[1]}, ${patterns9[2]}, ${patterns9[3]}, ___. (Write ${patterns9[0]} or ${patterns9[1]})`;
        answerText = patternAns9;
        type = 'choice';
        choices = [patterns9[0].toLowerCase(), patterns9[1].toLowerCase()];
        break;

      case 10:
        topic = 'Number Sense';
        const cmpPair10 = pick(qIdx, [[9, 5], [6, 4], [8, 3], [7, 2]]);
        questionText = `Which numeral is bigger: ${cmpPair10[0]} or ${cmpPair10[1]}?`;
        answerText = String(Math.max(cmpPair10[0], cmpPair10[1]));
        break;

      // --- Class 1 (Levels 12-22) ---
      case 12: {
        topic = 'Number Sense';
        const c12 = pick(qIdx, [
          { num: 23, q: 'tens', ans: 2 },
          { num: 47, q: 'ones', ans: 7 },
          { num: 68, q: 'tens', ans: 6 },
          { num: 35, q: 'ones', ans: 5 }
        ]);
        if (c12.q === 'tens') {
          questionText = `How many tens are in the number ${c12.num}?`;
        } else {
          questionText = `How many ones are in the number ${c12.num}?`;
        }
        answerText = String(c12.ans);
        break;
      }

      case 13: {
        topic = 'Number Sense';
        const c13 = pick(qIdx, [23, 27, 35, 41]);
        questionText = `What number is represented by ${Math.floor(c13 / 10)} tens and ${c13 % 10} ones?`;
        answerText = String(c13);
        break;
      }

      case 14: {
        topic = 'Number Sense';
        const c14 = pick(qIdx, [
          { word: 'fifteen', num: 15 },
          { word: 'eighteen', num: 18 },
          { word: 'twenty', num: 20 },
          { word: 'sixteen', num: 16 }
        ]);
        questionText = `Write the numeral for ${c14.word}:`;
        answerText = String(c14.num);
        break;
      }

      case 15: {
        topic = 'Number Sense';
        const c15 = pick(qIdx, [28, 19, 33, 41]);
        questionText = `What number comes between ${c15 - 1} and ${c15 + 1}?`;
        answerText = String(c15);
        break;
      }

      case 16: {
        const addConfigs16 = pick(qIdx, [
          { a: 16, b: 8 },
          { a: 17, b: 9 },
          { a: 18, b: 7 },
          { a: 19, b: 10 }
        ]);
        questionText = `Solve: ${addConfigs16.a} + ${addConfigs16.b} = ?`;
        answerText = String(addConfigs16.a + addConfigs16.b);
        break;
      }

      case 17: {
        const subConfigs17 = pick(qIdx, [
          { a: 29, b: 9 },
          { a: 26, b: 10 },
          { a: 29, b: 8 },
          { a: 25, b: 7 }
        ]);
        questionText = `Solve: ${subConfigs17.a} - ${subConfigs17.b} = ?`;
        answerText = String(subConfigs17.a - subConfigs17.b);
        break;
      }

      case 18:
        topic = 'Number Sense';
        const ascSet18 = pick(qIdx, [[25, 12, 19], [34, 8, 21], [47, 15, 33], [56, 22, 40]]);
        const ascAns18 = String(Math.min(...ascSet18));
        questionText = `Arrange in ascending (increasing) order: [${ascSet18.join(', ')}]. (Write lowest number first, e.g. ${ascAns18})`;
        answerText = ascAns18;
        break;

      case 19: {
        topic = 'Number Sense';
        const c19 = pick(qIdx, [45, 38, 52, 63]);
        questionText = `How many tens are in the number ${c19}?`;
        answerText = String(Math.floor(c19 / 10));
        break;
      }

      case 20: {
        topic = 'Number Sense';
        const c20 = pick(qIdx, [5, 3, 4, 6]);
        questionText = `Skip count by ${c20}s: ${c20}, ${c20 * 2}, ${c20 * 3}, ___. What is next?`;
        answerText = String(c20 * 4);
        break;
      }

      case 21: {
        topic = 'Number Sense';
        const cmpConfigs21 = pick(qIdx, [
          { kind: 'gt', a: 48, b: 42, ans: 'yes' },
          { kind: 'lt', a: 78, b: 82, ans: 'no' },
          { kind: 'eq', a: 60, b: 60, ans: '=' },
          { kind: 'diff', a: 91, b: 27, ans: '64' }
        ]);
        if (cmpConfigs21.kind === 'gt') {
          questionText = `Compare numbers: Is ${cmpConfigs21.a} greater than ${cmpConfigs21.b}? (Write Yes or No)`;
          choices = ['yes', 'no'];
        } else if (cmpConfigs21.kind === 'lt') {
          questionText = `Compare numbers: Is ${cmpConfigs21.a} less than ${cmpConfigs21.b}? (Write Yes or No)`;
          choices = ['yes', 'no'];
        } else if (cmpConfigs21.kind === 'eq') {
          questionText = `Compare numbers: Is ${cmpConfigs21.a} equal to ${cmpConfigs21.b}? (Write = or ≠)`;
          choices = ['=', '≠'];
        } else {
          questionText = `What is the difference between ${cmpConfigs21.a} and ${cmpConfigs21.b}?`;
        }
        answerText = String(cmpConfigs21.ans);
        type = 'choice';
        break;
      }

      case 22:
        topic = 'Number Sense';
        const descSet22 = pick(qIdx, [[32, 48, 15], [44, 19, 37], [58, 23, 41], [67, 31, 52]]);
        const descAns22 = String(Math.max(...descSet22));
        questionText = `Arrange in descending (decreasing) order: [${descSet22.join(', ')}]. (Write largest number first, e.g. ${descAns22})`;
        answerText = descAns22;
        break;

      // --- Class 2 (Levels 24-34) ---
      case 24: {
        topic = 'Number Sense';
        const c24 = pick(qIdx, [87, 65, 52, 73]);
        const word24 = pick(qIdx, ['eighty seven', 'sixty five', 'fifty two', 'seventy three']);
        questionText = `Write the numeral for ${word24}:`;
        answerText = String(c24);
        break;
      }

      case 25: {
        topic = 'Number Sense';
        const val25 = pick(qIdx, [94, 76, 58, 83]);
        questionText = `What is the place value of the digit ${Math.floor(val25 / 10)} in the number ${val25}? (Write 50, 70, or 90)`;
        answerText = String(Math.floor(val25 / 10) * 10);
        break;
      }

      case 26: {
        const carryConfigs26 = pick(qIdx, [
          { a: 47, b: 28 },
          { a: 53, b: 31 },
          { a: 58, b: 19 },
          { a: 65, b: 27 }
        ]);
        questionText = `Carry Addition: Solve ${carryConfigs26.a} + ${carryConfigs26.b} = ?`;
        answerText = String(carryConfigs26.a + carryConfigs26.b);
        break;
      }

      case 27: {
        const borrowConfigs27 = pick(qIdx, [
          { a: 73, b: 39 },
          { a: 85, b: 28 },
          { a: 64, b: 36 },
          { a: 92, b: 47 }
        ]);
        questionText = `Borrow Subtraction: Solve ${borrowConfigs27.a} - ${borrowConfigs27.b} = ?`;
        answerText = String(borrowConfigs27.a - borrowConfigs27.b);
        break;
      }

      case 28: {
        topic = 'Number Sense';
        const cmpConfigs28 = pick(qIdx, [
          { kind: 'gt', a: 92, b: 89, ans: '>' },
          { kind: 'lt', a: 75, b: 78, ans: '<' },
          { kind: 'eq', a: 56, b: 56, ans: '=' },
          { kind: 'diff', a: 42, b: 31, ans: '11' }
        ]);
        if (cmpConfigs28.kind === 'gt') {
          questionText = `Which symbol goes in the box: ${cmpConfigs28.a} [>] [?] [<] ${cmpConfigs28.b}? (Write > or <)`;
          choices = ['>', '<'];
        } else if (cmpConfigs28.kind === 'lt') {
          questionText = `Which symbol goes in the box: ${cmpConfigs28.a} [>] [?] [<] ${cmpConfigs28.b}? (Write > or <)`;
          choices = ['>', '<'];
        } else if (cmpConfigs28.kind === 'eq') {
          questionText = `Which symbol goes in the box: ${cmpConfigs28.a} [=] [?] [≠] ${cmpConfigs28.b}? (Write = or ≠)`;
          choices = ['=', '≠'];
        } else {
          questionText = `What is the difference between ${cmpConfigs28.a} and ${cmpConfigs28.b}?`;
        }
        answerText = cmpConfigs28.ans;
        type = 'choice';
        break;
      }

      case 29: {
        topic = 'Number Sense';
        const ascSet29 = pick(qIdx, [[74, 91, 58], [45, 82, 63], [67, 93, 51], [88, 74, 96]]);
        const ascAns29 = String(Math.min(...ascSet29));
        questionText = `Arrange in ascending order: [${ascSet29.join(', ')}]. (Write lowest number first, e.g. ${ascAns29})`;
        answerText = ascAns29;
        break;
      }

      case 30: {
        const tally30Configs = pick<[string[], number]>(qIdx, [
          [['||||', '|'], 6],
          [['|||', '||', '|'], 5],
          [['||||', '||'], 7],
          [['||', '|'], 3]
        ]);
        questionText = `Write the number represented by tally marks ${tally30Configs[0].join(' ')}:`;
        answerText = String(tally30Configs[1]);
        break;
      }

      case 31:
        const time31 = pick(qIdx, [['4:00', '4 o\'clock'], ['7:00', '7 o\'clock'], ['2:00', '2 o\'clock'], ['9:00', '9 o\'clock']]);
        questionText = `If the short hour hand is at ${time31[0].split(':')[0]} and the long minute hand is at 12, what time is it? (Write ${time31[0]})`;
        answerText = time31[0];
        break;

      case 32:
        topic = 'Number Sense';
        const words32 = pick<[string, number, string]>(qIdx, [['APPLE', 3, 'p'], ['BANANA', 2, 'a'], ['ORANGE', 5, 'e'], ['MANGO', 1, 'm']]);
        questionText = `In the word '${words32[0]}', which letter is in the ${words32[1]}${words32[1] === 1 ? 'st' : words32[1] === 2 ? 'nd' : words32[1] === 3 ? 'rd' : 'th'} position?`;
        answerText = words32[2];
        type = 'text';
        break;

      case 33: {
        const c33 = pick(qIdx, [4, 3, 5, 6]);
        questionText = `Repeated addition: 3 + 3 + 3 + 3 is the same as ${c33} groups of 3. What is the total?`;
        answerText = String(c33 * 3);
        break;
      }

      case 34:
        const unit34 = pick(qIdx, [5, 6, 4, 8]);
        const count34 = pick(qIdx, [2, 3, 2, 4]);
        questionText = `If one pencil is ${unit34} paperclips long, how many paperclips long are ${count34} pencils?`;
        answerText = String(unit34 * count34);
        break;

      // --- Class 3 (Levels 36-47) ---
      case 36: {
        topic = 'Number Sense';
        const c36Configs = pick(qIdx, [
          { num: 452, form: 'FULL' },
          { num: 318, form: 'TENS_ONES' },
          { num: 276, form: 'HUNDREDS_TENS' },
          { num: 583, form: 'ONES_DIGIT' }
        ]);
        const val36 = c36Configs.num;
        const form36 = c36Configs.form;
        if (form36 === 'FULL') {
          questionText = `What number is equal to ${Math.floor(val36 / 100)} hundreds, ${Math.floor((val36 % 100) / 10)} tens, and ${val36 % 10} ones?`;
          answerText = String(val36);
        } else if (form36 === 'TENS_ONES') {
          questionText = `What number is equal to ${Math.floor(val36 / 10)} tens and ${val36 % 10} ones?`;
          answerText = String(val36);
        } else if (form36 === 'HUNDREDS_TENS') {
          questionText = `What number has ${Math.floor(val36 / 100)} hundreds and ${Math.floor((val36 % 100) / 10)} tens, with zero ones?`;
          answerText = String(val36 - (val36 % 10));
        } else {
          questionText = `What digit is in the ones place of ${val36}?`;
          answerText = String(val36 % 10);
          type = 'number';
        }
        break;
      }

      case 37: {
        topic = 'Number Sense';
        const smallerConfigs37 = pick(qIdx, [
          { a: 634, b: 643, ans: 634 },
          { a: 432, b: 423, ans: 423 },
          { a: 751, b: 528, ans: 528 },
          { a: 298, b: 467, ans: 298 }
        ]);
        questionText = `Which is smaller: ${smallerConfigs37.a} or ${smallerConfigs37.b}?`;
        answerText = String(smallerConfigs37.ans);
        break;
      }

      case 38:
        topic = 'Number Sense';
        const desc38 = pick(qIdx, [[432, 756, 128], [945, 118, 601], [875, 240, 399], [1000, 501, 875]]);
        const descAns38 = String(Math.max(...desc38));
        questionText = `Arrange in descending order: [${desc38.join(', ')}]. (Write largest number first, e.g. ${descAns38})`;
        answerText = descAns38;
        break;

      case 39: {
        const addConfigs39 = pick(qIdx, [
          { a: 456, b: 238 },
          { a: 523, b: 167 },
          { a: 389, b: 275 },
          { a: 612, b: 198 }
        ]);
        questionText = `Solve: ${addConfigs39.a} + ${addConfigs39.b} = ?`;
        answerText = String(addConfigs39.a + addConfigs39.b);
        break;
      }

      case 40: {
        const subConfigs40 = pick(qIdx, [
          { a: 785, b: 296 },
          { a: 643, b: 187 },
          { a: 912, b: 538 },
          { a: 567, b: 349 }
        ]);
        questionText = `Solve: ${subConfigs40.a} - ${subConfigs40.b} = ?`;
        answerText = String(subConfigs40.a - subConfigs40.b);
        break;
      }

      case 41: {
        const multConfigs41 = pick(qIdx, [
          { a: 7, b: 8 },
          { a: 6, b: 9 },
          { a: 5, b: 7 },
          { a: 8, b: 6 }
        ]);
        questionText = `What is ${multConfigs41.a} times ${multConfigs41.b}?`;
        answerText = String(multConfigs41.a * multConfigs41.b);
        break;
      }

      case 42: {
        const divConfigs42 = pick(qIdx, [
          { a: 24, b: 4 },
          { a: 27, b: 3 },
          { a: 35, b: 5 },
          { a: 32, b: 4 }
        ]);
        questionText = `Divide: ${divConfigs42.a} items shared equally among ${divConfigs42.b} children. How many each?`;
        answerText = String(divConfigs42.a / divConfigs42.b);
        break;
      }

      case 43: {
        const c43 = pick(qIdx, [5, 3, 7, 4]);
        questionText = `Convert standard measurement: How many centimeters are in ${c43} meters? (Hint: 1m = 100cm)`;
        answerText = String(c43 * 100);
        break;
      }

      case 44:
        const month44 = pick(qIdx, [1, 2, 3, 4]);
        const monthAns44 = pick(qIdx, ['January', 'February', 'March', 'April']);
        questionText = `Which is month number ${month44} in a standard calendar year? (Write the month name, e.g. ${monthAns44})`;
        answerText = monthAns44;
        type = 'text';
        break;

      case 45:
        const frac45 = pick(qIdx, [[1, 4], [1, 2], [1, 3], [3, 4]]);
        const fracAns45 = `${frac45[0]}/${frac45[1]}`;
        questionText = `If a pizza is divided into ${frac45[1]} equal slices and Rahul eats ${frac45[0]} slice${frac45[0] > 1 ? 's' : ''}, what fraction of the pizza did Rahul eat? (Write ${fracAns45})`;
        answerText = fracAns45;
        type = 'text';
        break;

      case 46: {
        const coinConfigs46 = pick(qIdx, [
          { coins: 5, total: 50 },
          { coins: 3, total: 30 },
          { coins: 8, total: 80 },
          { coins: 4, total: 40 }
        ]);
        questionText = `How many 10-rupee coins do you need to make ${coinConfigs46.total} rupees?`;
        answerText = String(coinConfigs46.coins);
        break;
      }

      case 47: {
        const groupConfigs47 = pick(qIdx, [
          { boys: 5, girls: 7 },
          { boys: 4, girls: 6 },
          { boys: 6, girls: 3 },
          { boys: 8, girls: 5 }
        ]);
        questionText = `If Class A has ${groupConfigs47.boys} boys and ${groupConfigs47.girls} girls, how many total students are in Class A?`;
        answerText = String(groupConfigs47.boys + groupConfigs47.girls);
        break;
      }

      // --- Class 4 (Levels 49-58) ---
      case 49: {
        topic = 'Number Sense';
        const val49 = pick(qIdx, [7482, 3450, 5938, 8267]);
        questionText = `What is the place value of the digit ${Math.floor(val49 / 1000)} in the number ${val49}? (e.g. 7000)`;
        answerText = String(Math.floor(val49 / 1000) * 1000);
        break;
      }

      case 50: {
        const m50Configs = pick(qIdx, [
          { a: 45, b: 12 },
          { a: 34, b: 17 },
          { a: 56, b: 13 },
          { a: 72, b: 15 }
        ]);
        questionText = `Solve: ${m50Configs.a} × ${m50Configs.b} = ?`;
        answerText = String(m50Configs.a * m50Configs.b);
        break;
      }

      case 51: {
        const d51Configs = pick(qIdx, [
          { a: 125, b: 5 },
          { a: 96, b: 3 },
          { a: 144, b: 6 },
          { a: 147, b: 7 }
        ]);
        questionText = `Solve: ${d51Configs.a} ÷ ${d51Configs.b} = ?`;
        answerText = String(d51Configs.a / d51Configs.b);
        break;
      }

      case 52:
        const dir52 = pick(qIdx, [
          ['NORTH', 'clockwise', 'east'],
          ['SOUTH', 'clockwise', 'west'],
          ['EAST', 'clockwise', 'south'],
          ['WEST', 'clockwise', 'north']
        ]);
        questionText = `If you face ${dir52[0]} and make a quarter turn clockwise (right), which direction will you face? (East, West, South, North)`;
        answerText = dir52[2];
        type = 'choice';
        choices = ['east', 'west', 'south', 'north'];
        break;

      case 53: {
        const val53 = pick(qIdx, [6, 4, 7, 9]);
        questionText = `Find the smallest positive multiple of ${val53}:`;
        answerText = String(val53);
        break;
      }

      case 54:
        const frac54 = pick(qIdx, [[1, 2, 3], [2, 3, 5], [1, 4, 3], [3, 4, 7]]);
        const fracAns54 = `${frac54[2]}/${frac54[1]}`;
        questionText = `Add the fractions: ${frac54[0]}/${frac54[1]} + ${frac54[2]}/${frac54[1]} = ? (Write ${fracAns54})`;
        answerText = fracAns54;
        type = 'text';
        break;

      case 55:
        topic = 'Number Sense';
        const dec55 = pick(qIdx, [[3, 10, 0.3], [1, 10, 0.1], [7, 10, 0.7], [9, 10, 0.9]]);
        questionText = `Write the fraction ${dec55[0]}/${dec55[1]} as a decimal number: (Write ${dec55[2]})`;
        answerText = String(dec55[2]);
        type = 'text';
        break;

      case 56: {
        const side56 = pick(qIdx, [6, 5, 7, 8]);
        questionText = `What is the perimeter of a square with a side length of ${side56} cm?`;
        answerText = String(side56 * 4);
        break;
      }

      case 57:
        const ang57 = pick(qIdx, [90, 45, 120, 180]);
        const angType57 = ang57 === 90 ? 'right' : ang57 === 45 ? 'acute' : ang57 === 120 ? 'obtuse' : 'straight';
        const angName57 = ang57 === 90 ? 'Right' : ang57 === 45 ? 'Acute' : ang57 === 120 ? 'Obtuse' : 'Straight';
        questionText = `An angle that measures exactly ${ang57} degrees is called a ___ angle. (Right, Acute, Obtuse, Straight)`;
        answerText = angType57;
        type = 'choice';
        choices = ['right', 'acute', 'obtuse', 'straight'];
        break;

      case 58:
        const sym58 = pick(qIdx, [['square', 4], ['rectangle', 2], ['circle', 8], ['equilateral triangle', 3]]);
        questionText = `How many lines of symmetry does a standard ${sym58[0]} have?`;
        answerText = String(sym58[1]);
        type = 'text';
        break;

      // --- Fallback / Review Assessments ---
      case 11:
      case 23:
      case 35:
      case 48:
      case 59:
      default: {
        topic = 'Number Sense';
        const reviewConfigs = pick(qIdx, [
          { op: '+', a: 12, b: 5, ans: 17 },
          { op: '-', a: 14, b: 6, ans: 8 },
          { op: '×', a: 7, b: 3, ans: 21 },
          { op: '÷', a: 20, b: 4, ans: 5 }
        ]);
        const reviewA = reviewConfigs.a;
        const reviewB = reviewConfigs.b;
        if (reviewConfigs.op === '+') {
          questionText = `Review Assessment: What is ${reviewA} + ${reviewB}?`;
          answerText = String(reviewA + reviewB);
        } else if (reviewConfigs.op === '-') {
          questionText = `Review Assessment: What is ${reviewA} - ${reviewB}?`;
          answerText = String(reviewA - reviewB);
        } else if (reviewConfigs.op === '×') {
          questionText = `Review Assessment: What is ${reviewA} × ${reviewB}?`;
          answerText = String(reviewA * reviewB);
        } else {
          questionText = `Review Assessment: What is ${reviewConfigs.a * reviewConfigs.b} ÷ ${reviewConfigs.a}?`;
          answerText = String(reviewConfigs.b);
        }
        break;
      }
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
      svgAsset
    });
  }

  return questions;
}
