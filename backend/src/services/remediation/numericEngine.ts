import { blueprintEngine } from './blueprintEngine';

export interface NumericConstraint {
  min: number;
  max: number;
}

export class NumericEngine {
  /**
   * Generates a question and answer based on templateText and variableConstraints.
   */
  generate(templateText: string, variableConstraints: Record<string, NumericConstraint> = {}) {
    const values: Record<string, number> = {};
    let question = templateText;

    // Generate random values for each constraint key and substitute
    Object.entries(variableConstraints).forEach(([key, constraint]) => {
      const min = constraint.min !== undefined ? constraint.min : 1;
      const max = constraint.max !== undefined ? constraint.max : 100;
      const val = Math.floor(Math.random() * (max - min + 1)) + min;
      values[key] = val;
      question = question.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
    });

    let answer = 'Placeholder answer';
    try {
      // Evaluate comparison templates: e.g. "Is 10 greater than 5?"
      const lowercaseQ = question.toLowerCase();
      if (lowercaseQ.includes('greater than') || lowercaseQ.includes('larger than') || lowercaseQ.includes('more than')) {
        const keys = Object.keys(values);
        if (keys.length >= 2) {
          const valA = values[keys[0]];
          const valB = values[keys[1]];
          answer = valA > valB ? 'Yes' : 'No';
        }
      } else if (lowercaseQ.includes('less than') || lowercaseQ.includes('smaller than')) {
        const keys = Object.keys(values);
        if (keys.length >= 2) {
          const valA = values[keys[0]];
          const valB = values[keys[1]];
          answer = valA < valB ? 'Yes' : 'No';
        }
      } else if (lowercaseQ.includes('equal to')) {
        const keys = Object.keys(values);
        if (keys.length >= 2) {
          const valA = values[keys[0]];
          const valB = values[keys[1]];
          answer = valA === valB ? 'Yes' : 'No';
        }
      } else {
        // Fallback to evaluating arithmetic expression from template
        const mathExpression = question.replace(/[^0-9+\-*/\s()]/g, '').trim();
        if (mathExpression && /^[0-9+\-*/\s()]+$/.test(mathExpression)) {
          // eslint-disable-next-line no-eval
          const result = eval(mathExpression);
          answer = String(result);
        }
      }
    } catch {
      answer = 'Evaluator error';
    }

    return {
      question,
      answer,
      values
    };
  }

  /**
   * Generates a numeric practice question dynamically by mutating numbers in originalQuestion
   * and computing the exact math answer for variantIndex while preserving original question structure.
   */
  generateFromQuestion(originalQuestion: string, conceptName: string = 'Mathematics', variantIndex: number = 0) {
    const lowerQ = originalQuestion.toLowerCase();

    // 1. Digit in Number Place Value (e.g. "What is the place value of the digit 9 in the number 94? (Write 50, 70, or 90)")
    if (lowerQ.includes('digit') && (lowerQ.includes('number') || lowerQ.includes('write'))) {
      const presets2D = [
        { targetDigit: 6, num: 62, choices: '(Write 40, 60, or 80)', ans: '60' },
        { targetDigit: 4, num: 45, choices: '(Write 20, 40, or 60)', ans: '40' },
        { targetDigit: 8, num: 83, choices: '(Write 50, 70, or 80)', ans: '80' },
        { targetDigit: 3, num: 39, choices: '(Write 10, 30, or 50)', ans: '30' },
        { targetDigit: 7, num: 71, choices: '(Write 50, 70, or 90)', ans: '70' }
      ];
      const p = presets2D[variantIndex % presets2D.length];

      let question = originalQuestion;
      if (/digit\s+\d+/i.test(question) && /number\s+\d+/i.test(question)) {
        question = question
          .replace(/digit\s+\d+/i, `digit ${p.targetDigit}`)
          .replace(/number\s+\d+/i, `number ${p.num}`);
        if (/\(write[^)]+\)/i.test(question)) {
          question = question.replace(/\(write[^)]+\)/i, p.choices);
        }
      } else {
        question = `What is the place value of the digit ${p.targetDigit} in the number ${p.num}? ${p.choices}`;
      }

      return {
        question,
        answer: p.ans,
        aiGenerated: false
      };
    }

    // 2. Underlined digit Place Value (e.g. "7_8_4")
    if (originalQuestion.includes('_')) {
      const presets = [
        { d1: 3, d2: 8, d3: 2, ans: '80 (8 tens)' },
        { d1: 5, d2: 4, d3: 9, ans: '40 (4 tens)' },
        { d1: 9, d2: 1, d3: 7, ans: '10 (1 ten)' },
        { d1: 6, d2: 7, d3: 3, ans: '70 (7 tens)' },
        { d1: 4, d2: 2, d3: 8, ans: '20 (2 tens)' }
      ];
      const p = presets[variantIndex % presets.length];
      const question = originalQuestion.replace(/\d+_\d+_\d+/g, `${p.d1}_${p.d2}_${p.d3}`);
      return {
        question,
        answer: p.ans,
        aiGenerated: false
      };
    }

    // 3. Length comparison fallback if title is "Long or Short?" (Child-Friendly)
    if (lowerQ.includes('long') || lowerQ.includes('short')) {
      const samples = [
        { question: 'Which pencil is LONGER? Pencil A ✏️✏️✏️ vs Pencil B ✏️', answer: 'Pencil A' },
        { question: 'Which ribbon is SHORTER? Ribbon A 🎗️🎗️ vs Ribbon B 🎗️🎗️🎗️🎗️', answer: 'Ribbon A' },
        { question: 'Circle the LONGER caterpillar: Caterpillar A 🐛🐛🐛 vs Caterpillar B 🐛', answer: 'Caterpillar A' },
        { question: 'Which line of dots is SHORTER? Line A 🔴🔴 vs Line B 🔴🔴🔴🔴🔴', answer: 'Line A' },
        { question: 'Which tree is TALLER? Tree A 🌲🌲🌲 vs Tree B 🌲', answer: 'Tree A' },
        { question: 'Circle the LONGER train: Train A 🚃🚃🚃 vs Train B 🚃', answer: 'Train A' },
        { question: 'Which snake is SHORTER? Snake A 🐍🐍 vs Snake B 🐍🐍🐍🐍', answer: 'Snake A' }
      ];
      const pick = samples[variantIndex % samples.length];
      return { question: pick.question, answer: pick.answer, aiGenerated: false };
    }

    // 4. General Numeric mutation (preserves original question sentence structure)
    const cleanQuestion = originalQuestion.replace(/[\s—–-]*Item\s*\d+/gi, '').trim();
    const numbers = cleanQuestion.match(/\d+/g)?.map(Number) || [];
    let question = cleanQuestion || originalQuestion;
    let answer = 'Computed answer';

    if (numbers.length > 0) {
      const numbersCopy = [...numbers];
      question = cleanQuestion.replace(/\d+/g, () => {
        const original = numbersCopy.shift()!;
        let variation = original;
        if (original <= 10) {
          variation = Math.max(1, ((original + (variantIndex + 1) * 2 - 1) % 10) + 1);
        } else if (original <= 100) {
          variation = Math.max(10, ((original + (variantIndex + 1) * 7) % 90) + 10);
        } else {
          variation = Math.max(100, ((original + (variantIndex + 1) * 25) % 900) + 100);
        }
        return String(variation);
      });

      try {
        const mathExpression = question.replace(/[^0-9+\-*/\s()]/g, '').trim();
        if (mathExpression && /^[0-9+\-*/\s()]+$/.test(mathExpression)) {
          // eslint-disable-next-line no-eval
          const result = eval(mathExpression);
          answer = String(result);
        }
      } catch {
        answer = 'Compute from question';
      }
    } else {
      const fb = blueprintEngine.generate(originalQuestion, conceptName, 'standard', '', variantIndex);
      question = fb.question;
      answer = fb.answer;
    }

    return {
      question,
      answer,
      aiGenerated: false
    };
  }
}

export const numericEngine = new NumericEngine();
