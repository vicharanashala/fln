import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes.js';
import studentRoutes from './modules/students/student.routes.js';
import baselineRoutes from './modules/baseline/baseline.routes.js';
import { BANDS } from './domain/levels.js';
import { authenticate } from './core/middleware/auth.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok' }));
router.get('/levels', authenticate, (_req, res) => res.json(BANDS));

router.use('/auth', authRoutes);
router.use('/students', studentRoutes);
router.use('/baseline', baselineRoutes);

export default router;
