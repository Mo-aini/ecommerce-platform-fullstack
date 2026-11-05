import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server forwards API and image requests to the Express server
const target = process.env.API_PROXY_TARGET || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.CLIENT_PORT) || 5173,
    proxy: {
      '/api': target,
      '/images': target,
    },
  },
});
