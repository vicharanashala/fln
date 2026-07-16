import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api/assessments": { target: "http://localhost:5000", changeOrigin: true },
      "/api/templates": { target: "http://localhost:5000", changeOrigin: true },
      "/uploads": { target: "http://localhost:5000", changeOrigin: true },
      "/extracted-images": { target: "http://localhost:5000", changeOrigin: true },
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/output": { target: "http://localhost:3000", changeOrigin: true },
      "/worksheets": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});