import { IBlueprintQuestion } from '../../interfaces/examBlueprint.interface';
import { numericEngine } from './numericEngine';
import { matrixEngine } from './matrixEngine';
import { generativeEngine } from './generativeEngine';

export class RouterService {
  /**
   * Reads the question type field from the blueprint and routes to the appropriate engine.
   */
  async route(blueprint: IBlueprintQuestion) {
    switch (blueprint.type) {
      case 'NUMERIC':
        return numericEngine.generate(blueprint.templateText, blueprint.variableConstraints);
      case 'MATRIX':
        return matrixEngine.generate(blueprint.templateText, blueprint.matrixArrays);
      case 'GENERATIVE':
        return await generativeEngine.generate(blueprint.templateText, blueprint.promptTemplate);
      default:
        throw new Error(`Unsupported engine type: ${(blueprint as any).type}`);
    }
  }
}

export const routerService = new RouterService();
