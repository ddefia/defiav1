
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

// Load key manually
const envPath = path.resolve(process.cwd(), '.env.production.local');
let API_KEY = "";

try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/GEMINI_API_KEY=(.+)/);
    if (match) {
        API_KEY = match[1].trim();
    }
} catch (e) {
    console.error("Could not read .env.production.local");
}

if (!API_KEY) {
    API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.API_KEY;
}

async function listV1Models() {
    if (!API_KEY) { console.error("No Key"); return; }

    console.log("Checking v1 models with key ending in...", API_KEY.slice(-5));
    const url = `https://generativelanguage.googleapis.com/v1/models?key=${API_KEY}`;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.log("Error Status:", res.status);
            console.log(await res.text());
            return;
        }
        const data = await res.json();
        if (data.models) {
            const imagenModels = data.models.filter(m => m.name.includes("imagen"));
            console.log("Imagen Models (v1):", JSON.stringify(imagenModels, null, 2));
        } else {
            console.log("No models found or error:", data);
        }
    } catch (e) {
        console.error(e);
    }
}

listV1Models();
