import express from 'express';
import cors from 'cors';
import remediationRoutes from './routes/remediation.routes';
import blueprintRoutes from './routes/blueprint.routes';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    data: null
  });
});

app.use('/api/remediation', remediationRoutes);
app.use('/api/blueprints', blueprintRoutes);

export default app;