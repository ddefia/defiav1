import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Required env vars for production:
// GEMINI_API_KEY — Server-side only (NOT injected into client bundle)
// VITE_SUPABASE_URL — Supabase project URL
// VITE_SUPABASE_ANON_KEY — Supabase anonymous/public key
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  console.log("BUILD DEBUG: Loaded Env");

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
      // Stripe publishable keys (safe for client)
      'import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY': JSON.stringify(env.VITE_STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY || ''),
      'import.meta.env.VITE_STRIPE_STARTER_PRICE_ID': JSON.stringify(env.VITE_STRIPE_STARTER_PRICE_ID || process.env.VITE_STRIPE_STARTER_PRICE_ID || ''),
      'import.meta.env.VITE_STRIPE_GROWTH_PRICE_ID': JSON.stringify(env.VITE_STRIPE_GROWTH_PRICE_ID || process.env.VITE_STRIPE_GROWTH_PRICE_ID || ''),
      // NOTE: GEMINI_API_KEY, APIFY_API_TOKEN, DUNE_API_KEY are intentionally NOT injected.
      // They stay server-side only. Client calls go through /api/gemini/* proxy.
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
