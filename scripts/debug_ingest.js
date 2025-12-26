import 'dotenv/config';
import { updateAllBrands } from '../server/agent/ingest.js';

console.log("Running ingestion debug...");
const key = process.env.APIFY_API_TOKEN;
console.log("Key available?", !!key);

if (!key) {
    console.error("No APIFY_API_TOKEN found in environment (via .env)");
    process.exit(1);
}

try {
    console.log("Starting updateAllBrands...");
    await updateAllBrands(key);
    console.log("updateAllBrands finished.");
} catch (e) {
    console.error("Ingestion failed:", e);
}
