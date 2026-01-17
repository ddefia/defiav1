
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_FILE = path.join(__dirname, '../server/cache/social_metrics.json');

const INITIAL_DATA = {
    'enki': { totalFollowers: 93500, handle: 'ENKIProtocol', lastUpdated: new Date().toISOString() },
    'netswap': { totalFollowers: 22100, handle: 'netswapofficial', lastUpdated: new Date().toISOString() },
    'lazai': { totalFollowers: 5000, handle: 'LazAINetwork', lastUpdated: new Date().toISOString() },
    'defia': { totalFollowers: 15000, handle: 'DefiaLabs', lastUpdated: new Date().toISOString() },
    'meme': { totalFollowers: 2500, handle: 'MetisL2', lastUpdated: new Date().toISOString() }
};

console.log("Warming Cache with Baseline Data...");
// Ensure dir exists
if (!fs.existsSync(path.dirname(CACHE_FILE))) {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
}

fs.writeFileSync(CACHE_FILE, JSON.stringify(INITIAL_DATA, null, 2));
console.log("Cache Warmed at:", CACHE_FILE);
