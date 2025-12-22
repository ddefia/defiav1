
import 'dotenv/config';
import { updateAllBrands } from '../server/agent/ingest.js';

console.log("Forcing Social Sync...");
await updateAllBrands(process.env.APIFY_API_TOKEN);
console.log("Done.");
