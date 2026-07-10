require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const schoolRoutes = require('./routes/schools');
const classRoutes = require('./routes/classes');
const studentRoutes = require('./routes/students');
const worksheetRoutes = require('./routes/worksheets');
const assessmentRoutes = require('./routes/assessments');
const evaluationRoutes = require('./routes/evaluations');
const analyticsRoutes = require('./routes/analytics');
const logbookRoutes = require('./routes/logbook');
const announcementRoutes = require('./routes/announcements');
const ticketRoutes = require('./routes/tickets');
const assetRoutes = require('./routes/assets');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(morgan('dev'));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/worksheets', worksheetRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/evaluation', evaluationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/logbook', logbookRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/assets', assetRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
