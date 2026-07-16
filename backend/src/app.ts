import express from 'express';
import cors from 'cors';
import { errorHandler } from './middlewares/errorHandler';
import stateRoutes from './routes/state.routes';
import districtRoutes from './routes/district.routes';
import blockRoutes from './routes/block.routes';
import schoolRoutes from './routes/school.routes';
import authRoutes from './routes/auth.routes';
import teacherRoutes from './routes/teacher.routes';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'Server is running', data: null });
});

app.use('/api/auth', authRoutes);
app.use('/api/states', stateRoutes);
app.use('/api/districts', districtRoutes);
app.use('/api/blocks', blockRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/teachers', teacherRoutes);

app.use(errorHandler);

export default app;
