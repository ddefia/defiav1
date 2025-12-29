
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

// Mimic check_models.js loading
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

async function testImagenFetch() {
    console.log("Testing Imagen 4.0 with FETCH...");

    if (!API_KEY) {
        console.error("No API Key found");
        return;
    }

    // Try Imagen 4 first (since 3 was 404)
    // Using PREDICT method via REST
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${API_KEY}`;

    console.log("Calling URL:", url.replace(API_KEY, "HIDDEN"));

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instances: [
                    { prompt: "A futuristic city with glowing neon lights, 3d render" }
                ],
                parameters: {
                    sampleCount: 1,
                    aspectRatio: '16:9'
                }
            })
        });

        if (!response.ok) {
            const txt = await response.text();
            console.error("Fetch Failed:", response.status, txt);
        } else {
            const data = await response.json();
            console.log("Success!");
            // console.log(JSON.stringify(data, null, 2));
            if (data.predictions && data.predictions[0]) {
                console.log("Image generated. Data length:", data.predictions[0].bytesBase64Encoded ? data.predictions[0].bytesBase64Encoded.length : "No bytes");
            }
        }

    } catch (error) {
        console.error("Fetch Exception:", error.message);
    }
}

testImagenFetch();
