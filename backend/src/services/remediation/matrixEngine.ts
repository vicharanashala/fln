export interface MatrixArrays {
  targetGroup: string[];
  foilGroup: string[];
}

export class MatrixEngine {
  /**
   * Generates a question by selecting targets and a foil option from matrixArrays.
   */
  generate(templateText: string, matrixArrays: MatrixArrays = { targetGroup: [], foilGroup: [] }) {
    const targets = matrixArrays.targetGroup && matrixArrays.targetGroup.length > 0
      ? [...matrixArrays.targetGroup]
      : ['apple', 'banana', 'orange', 'mango'];

    const foils = matrixArrays.foilGroup && matrixArrays.foilGroup.length > 0
      ? [...matrixArrays.foilGroup]
      : ['chair', 'table', 'desk', 'bed'];

    // Select 3 targets and 1 foil
    const selectedTargets: string[] = [];
    for (let i = 0; i < 3; i++) {
      if (targets.length === 0) break;
      const idx = Math.floor(Math.random() * targets.length);
      selectedTargets.push(targets.splice(idx, 1)[0]);
    }

    const foilIdx = Math.floor(Math.random() * foils.length);
    const selectedFoil = foils[foilIdx] || 'chair';

    const pool = [...selectedTargets, selectedFoil];
    // Shuffle the pool
    const shuffled = pool.sort(() => Math.random() - 0.5);

    const question = `${templateText} Options: ${shuffled.join(', ')}`;
    const answer = selectedFoil;

    return {
      question,
      answer,
      values: shuffled
    };
  }
}

export const matrixEngine = new MatrixEngine();
