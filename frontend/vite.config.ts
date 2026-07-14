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
      // Forward backend routes to the old JSON backend (port 3000) for
      // non-mocked fetch fall-throughs. New MongoDB backend (port 5000) is
      // called directly by Axios (CORS-enabled).
      proxy: {
        '/api': { target: process.env.VITE_API_TARGET || 'http://localhost:3000', changeOrigin: true },
        '/output': { target: process.env.VITE_API_TARGET || 'http://localhost:3000', changeOrigin: true },
        '/worksheets': { target: process.env.VITE_API_TARGET || 'http://localhost:3000', changeOrigin: true },
      },
    },
  };
});
