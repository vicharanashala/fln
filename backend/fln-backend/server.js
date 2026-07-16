const express = require('express');
const path = require('path');
const { closeBrowser } = require('./services/renderWorksheet');
const generateRoutes = require('./routes/generate');
const downloadRoutes = require('./routes/download');

const app = express();

app.use(express.json({ limit: '5mb' }));
app.use('/api', generateRoutes);
app.use('/api', downloadRoutes);

// Minimal two-button demo UI
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`FLN worksheet backend listening on http://127.0.0.1:${PORT}`);
});

// A second dev watcher can be started accidentally while the first levels
// backend is still running.  The first instance can serve all requests, so
// report that clearly instead of throwing an unhandled EADDRINUSE error.
server.once('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.log(`FLN worksheet backend is already running on http://localhost:${PORT}`);
    process.exit(0);
  }
  console.error('Unable to start FLN worksheet backend:', error);
  process.exit(1);
});

// Graceful shutdown: close the shared Puppeteer browser instance too.
async function shutdown(signal) {
  console.log(`\nReceived ${signal}, shutting down...`);
  server.close();
  await closeBrowser();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;
