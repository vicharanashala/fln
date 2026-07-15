import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: ['**/data/**', '**/db.json']
      },
      // Forward backend routes to the real API server (backend, :3000).
      // The in-browser mock (src/mock) intercepts most /api calls before they
      // reach the network; anything it does NOT handle (e.g. real PDF/diagnostic
      // generation) falls through to here and is proxied to the backend.
      // Override the target with VITE_API_TARGET if the backend runs elsewhere.
      proxy: {
        '/api': { target: process.env.VITE_API_TARGET || 'http://localhost:3000', changeOrigin: true },
        '/output': { target: process.env.VITE_API_TARGET || 'http://localhost:3000', changeOrigin: true },
        '/worksheets': { target: process.env.VITE_API_TARGET || 'http://localhost:3000', changeOrigin: true },
      },
    },
  };
});
