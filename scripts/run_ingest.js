
import 'dotenv/config';
import { updateAllBrands } from '../server/agent/ingest.js';

const token = process.env.APIFY_API_TOKEN;
if (!token) {
    console.error("No APIFY_API_TOKEN found in .env");
    process.exit(1);
}

console.log("Starting Manual Ingestion...");
updateAllBrands(token).then(() => {
    console.log("Done.");
}).catch(e => {
    console.error("Failed:", e);
});
