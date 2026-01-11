import 'dotenv/config';
import { ingestTwitterHistory } from '../services/ingestion';
import { createClient } from '@supabase/supabase-js';

// Load env vars
// dotenv.config(); // Handled by import

const run = async () => {
    console.log("🚀 Starting Manual Ingestion...");

    const accounts = ['LazAINetwork'];

    try {
        const results = await ingestTwitterHistory(accounts);
        console.log("✅ Ingestion Results:", JSON.stringify(results, null, 2));
    } catch (e) {
        console.error("❌ Fatal Error:", e);
    }
};

run();
