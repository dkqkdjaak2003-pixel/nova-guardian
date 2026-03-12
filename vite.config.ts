import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    allowedHosts: 'all',
  },
  preview: {
    allowedHosts: 'all',
  },
});
