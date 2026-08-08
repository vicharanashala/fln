import { Router } from 'express';
import { remediationController } from '../controllers/remediation.controller';

const router = Router();

router.post('/generate', remediationController.generate.bind(remediationController));
router.get('/ledgers', remediationController.getLedgersForStudent.bind(remediationController));
router.get('/:studentId/:examId', remediationController.getLedgerByStudentAndExam.bind(remediationController));
router.get('/batch/:examId', remediationController.getBatchLedgers.bind(remediationController));

export default router;
