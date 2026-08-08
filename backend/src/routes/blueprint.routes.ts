import { Router } from 'express';
import { blueprintController } from '../controllers/blueprint.controller';

const router = Router();

router.get('/', blueprintController.getBlueprints.bind(blueprintController));
router.post('/', blueprintController.createBlueprint.bind(blueprintController));
router.put('/:id', blueprintController.updateBlueprint.bind(blueprintController));
router.delete('/:id', blueprintController.deleteBlueprint.bind(blueprintController));
router.post('/:id/test-generate', blueprintController.testGenerate.bind(blueprintController));

export default router;
