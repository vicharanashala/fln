import express from 'express';
import { errorHandler } from './middleware/errorHandler';
// import studentRoutes from './routes/studentRoutes';

const app = express();

app.use(express.json());

// Example: Register your routers here
// app.use('/api/students', studentRoutes);

// Catch-all for unhandled routes (Optional but recommended)
app.all('*', (req, res, next) => {
  const err = new Error(`Can't find ${req.originalUrl} on this server!`);
  (err as any).statusCode = 404;
  next(err);
});

// Mount the global error handler at the very end
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
