module.exports = {
  apps: [
    {
      name: 'fln-backend',
      script: 'backend/dist/server.cjs',
      env: { NODE_ENV: 'production', PORT: 3000 },
    },
    {
      name: 'fln-ocr',
      script: 'uvicorn',
      args: 'ocr_server:app --host 127.0.0.1 --port 8001 --workers 1',
      cwd: './ai-services',
      interpreter: 'python3',
      wait_ready: true,
      // TrOCR/EasyOCR model can take 15-30s to load on first start
      listen_timeout: 60000,
    },
  ],
};
