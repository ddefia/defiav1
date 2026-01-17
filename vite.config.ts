import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Debug Log to see what Vercel is actually providing
  console.log("BUILD DEBUG: Loaded Env");
  console.log("GEMINI_API_KEY present:", !!env.GEMINI_API_KEY || !!process.env.GEMINI_API_KEY);
  console.log("VITE_GEMINI_API_KEY present:", !!env.VITE_GEMINI_API_KEY || !!process.env.VITE_GEMINI_API_KEY);

  const finalApiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!finalApiKey) {
    console.warn("WARNING: GEMINI_API_KEY is missing from build environment!");
  }

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      // FORCE inject the key into import.meta.env to bypass VITE_ prefix filtering
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(finalApiKey),
      'import.meta.env.GEMINI_API_KEY': JSON.stringify(finalApiKey),
      'process.env.API_KEY': JSON.stringify(finalApiKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(finalApiKey),
      'process.env.APIFY_API_TOKEN': JSON.stringify(env.APIFY_API_TOKEN || process.env.APIFY_API_TOKEN),
      'process.env.DUNE_API_KEY': JSON.stringify(env.DUNE_API_KEY || process.env.DUNE_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
