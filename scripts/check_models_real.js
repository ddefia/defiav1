
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const apiKey = process.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.error("NO API KEY FOUND IN .env");
    process.exit(1);
}

console.log("Using API Key:", apiKey.substring(0, 10) + "...");

const ai = new GoogleGenAI({ apiKey });

async function listModels() {
    try {
        console.log("Fetching available models...");
        const response = await ai.models.list();
        // The SDK might return an async iterator or a response object depending on version.
        // Let's assume response.models or iterate.

        console.log("\n--- AVAILABLE MODELS ---");
        for await (const model of response) {
            console.log(`- ${model.name} (${model.displayName})`);
            console.log(`  Supported: ${model.supportedGenerationMethods?.join(', ')}`);
        }
    } catch (e) {
        console.error("Error listing models:", e);
        // Fallback: try listModels() standard way if SDK differs
    }
}

listModels();
