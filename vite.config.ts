import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` keeps the build portable: it works from any sub-path
// (GitHub Pages, Netlify, a USB stick…).
export default defineConfig({
  base: './',
  plugins: [react()],
  // The whole tree-of-life dataset is bundled into the app, so the main chunk is large by design.
  build: { chunkSizeWarningLimit: 1500 },
});
