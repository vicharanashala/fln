import express from 'express';
import cors from 'cors';
import { errorHandler } from './middlewares/errorHandler';
import stateRoutes from './routes/state.routes';
import districtRoutes from './routes/district.routes';
import blockRoutes from './routes/block.routes';
import schoolRoutes from './routes/school.routes';
import authRoutes from './routes/auth.routes';
import teacherRoutes from './routes/teacher.routes';
import classRoutes from './routes/class.routes';
import studentRoutes from './routes/student.routes';
import adminRoutes from './routes/admin.routes';
import diagnosticRoutes from './routes/diagnostic.routes';
import path from "path";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const outputDir = path.join(process.cwd(), "output");

app.use("/output", express.static(outputDir));

app.get('/api/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'Server is running', data: null });
});

app.use('/api/auth', authRoutes);
app.use('/api/states', stateRoutes);
app.use('/api/districts', districtRoutes);
app.use('/api/blocks', blockRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/diagnostic', diagnosticRoutes);

app.use(errorHandler);

export default app;
