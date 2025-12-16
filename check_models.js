
import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';

async function main() {
    try {
        // Load key manually from .env.production.local
        const envPath = path.resolve(process.cwd(), '.env.production.local');
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const match = envContent.match(/GEMINI_API_KEY=(.+)/);

        if (!match) {
            console.error("❌ Could not find GEMINI_API_KEY in .env.production.local");
            process.exit(1);
        }

        const apiKey = match[1].trim();
        console.log(`🔑 Found API Key: ${apiKey.substring(0, 5)}...`);

        const ai = new GoogleGenAI({ apiKey: apiKey });

        console.log("📡 Connecting to Gemini API (v1beta)...");

        const response = await ai.models.list();
        console.log("✅ RAW RESPONSE:", JSON.stringify(response, null, 2));

    } catch (error) {
        console.error("❌ Error:", error);
        // @ts-ignore
        if (error.response) {
            // @ts-ignore
            console.error("Response:", JSON.stringify(error.response, null, 2));
        }
    }
}

main();
