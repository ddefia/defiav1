import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

async function listModels() {
    console.log("Checking API Key:", process.env.VITE_GEMINI_API_KEY ? "Found" : "Missing");
    // Try both standard names for the key just in case
    const key = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    if (!key) {
        console.error("No API Key found. Make sure .env.local exists and has VITE_GEMINI_API_KEY or GEMINI_API_KEY");
        return;
    }

    const ai = new GoogleGenAI({ apiKey: key });

    try {
        console.log("Listing models...");
        const response = await ai.models.list();
        console.log("Available Models:");
        // @ts-ignore
        for (const model of response.models) {
            console.log(`- ${model.name} (${model.displayName}): ${model.supportedGenerationMethods.join(', ')}`);
        }
    } catch (e) {
        console.error("Failed to list models:", e);
    }
}

listModels();
