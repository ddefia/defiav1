import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Required env vars for production:
// GEMINI_API_KEY (or VITE_GEMINI_API_KEY) — Google Gemini AI
// VITE_SUPABASE_URL — Supabase project URL
// VITE_SUPABASE_ANON_KEY — Supabase anonymous/public key
// APIFY_API_TOKEN — Apify web scraping (optional)
// DUNE_API_KEY — Dune Analytics on-chain data (optional)
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
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        }
      }
    },
    plugins: [react()],
    define: {
      // FORCE inject the key into import.meta.env to bypass VITE_ prefix filtering
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(finalApiKey),
      'import.meta.env.GEMINI_API_KEY': JSON.stringify(finalApiKey),
      'process.env.API_KEY': JSON.stringify(finalApiKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(finalApiKey),
      'process.env.APIFY_API_TOKEN': JSON.stringify(env.APIFY_API_TOKEN || env.VITE_APIFY_API_TOKEN || process.env.APIFY_API_TOKEN),
      'process.env.VITE_APIFY_API_TOKEN': JSON.stringify(env.APIFY_API_TOKEN || env.VITE_APIFY_API_TOKEN || process.env.APIFY_API_TOKEN),
      'import.meta.env.VITE_APIFY_API_TOKEN': JSON.stringify(env.APIFY_API_TOKEN || env.VITE_APIFY_API_TOKEN || process.env.APIFY_API_TOKEN),
      'process.env.DUNE_API_KEY': JSON.stringify(env.DUNE_API_KEY || process.env.DUNE_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      chunkSizeWarningLimit: 1600
    }
  };
});
