const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3000;
const CLIENT_BUILD = path.join(__dirname, '..', 'client', 'build');
const API_TARGET = process.env.API_TARGET || 'http://localhost:5000';

app.use('/api', createProxyMiddleware({ target: API_TARGET, changeOrigin: true }));

app.use(express.static(CLIENT_BUILD));

app.get('*', (req, res) => {
  res.sendFile(path.join(CLIENT_BUILD, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Production server running on http://localhost:${PORT}`);
  console.log(`API proxied to ${API_TARGET}`);
  console.log(`Serving static files from ${CLIENT_BUILD}`);
});
