
import 'dotenv/config'; // Load .env file
import express from 'express';
import cors from 'cors';
import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { startAgent } from './server/agent/scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for the frontend (Vite runs on 3000 usually)
app.use(cors());
app.use(express.json());

const KEY_FILE_PATH = path.join(__dirname, 'service-account.json');

// Check if key exists
if (!fs.existsSync(KEY_FILE_PATH)) {
    console.warn("⚠️  WARNING: service-account.json not found in root directory.");
    console.warn("    Imagen 3 generation will fail until you place the JSON key file here.");
}

app.post('/api/generate-image', async (req, res) => {
    try {
        if (!fs.existsSync(KEY_FILE_PATH)) {
            throw new Error("Service Account Key (service-account.json) is missing on the server.");
        }

        const { prompt, aspectRatio } = req.body;

        // 1. Authenticate
        const auth = new GoogleAuth({
            keyFile: KEY_FILE_PATH,
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });

        const client = await auth.getClient();
        const projectId = await auth.getProjectId();
        const accessToken = await client.getAccessToken();

        if (!projectId) throw new Error("Could not determine Project ID from Service Account.");

        // 2. Prepare Request for Imagen 3
        // Endpoint: https://us-central1-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict
        const location = 'us-central1';
        const modelId = 'imagen-3.0-generate-001';
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;

        const requestBody = {
            instances: [
                { prompt: prompt }
            ],
            parameters: {
                sampleCount: 1,
                aspectRatio: aspectRatio || "16:9",
                safetyFilterLevel: "block_low_and_above",
                personGeneration: "allow_adult"
            }
        };

        console.log(`[Proxy] Generating image via Vertex AI (${projectId})...`);

        // 3. Call Vertex AI
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[Proxy] Vertex AI Error:", errorText);
            throw new Error(`Vertex AI API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();

        // 4. Extract Image
        // Response format: { predictions: [ { bytesBase64Encoded: "..." } ] }
        const predictions = data.predictions;
        if (!predictions || predictions.length === 0 || !predictions[0].bytesBase64Encoded) {
            throw new Error("No image data returned from Vertex AI.");
        }

        const base64Image = `data:image/png;base64,${predictions[0].bytesBase64Encoded}`;

        console.log("[Proxy] Success! Sending image to client.");
        res.json({ image: base64Image });

    } catch (error) {
        console.error("[Proxy] Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- LunarCrush Proxy Endpoints ---

const getLunarKey = () => process.env.VITE_LUNARCRUSH_API_KEY || process.env.LUNARCRUSH_API_KEY;

app.get('/api/lunarcrush/creator/:screen_name', async (req, res) => {
    const { screen_name } = req.params;
    const apiKey = getLunarKey();

    if (!apiKey) return res.status(500).json({ error: "Server missing LunarCrush API Key" });

    try {
        console.log(`[Proxy] Fetching LunarCrush Creator: ${screen_name}`);
        const response = await fetch(`https://lunarcrush.com/api4/public/creator/twitter/${screen_name}/v1`, {
            headers: { "Authorization": `Bearer ${apiKey}` }
        });

        if (!response.ok) {
            const txt = await response.text();
            console.warn(`[Proxy] LC Error: ${response.status} - ${txt}`);
            return res.status(response.status).json({ error: txt });
        }

        const data = await response.json();
        res.json(data);
    } catch (e) {
        console.error("[Proxy] LC Exception:", e.message);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/lunarcrush/time-series/:screen_name', async (req, res) => {
    const { screen_name } = req.params;
    const { interval = '1d' } = req.query;
    const apiKey = getLunarKey();

    if (!apiKey) return res.status(500).json({ error: "Server missing LunarCrush API Key" });

    try {
        console.log(`[Proxy] Fetching LC Time Series: ${screen_name}`);
        const response = await fetch(`https://lunarcrush.com/api4/public/creator/twitter/${screen_name}/time-series/v1?interval=${interval}`, {
            headers: { "Authorization": `Bearer ${apiKey}` }
        });
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/lunarcrush/posts/:screen_name', async (req, res) => {
    const { screen_name } = req.params;
    const apiKey = getLunarKey();
    if (!apiKey) return res.status(500).json({ error: "Server missing LunarCrush API Key" });

    try {
        const response = await fetch(`https://lunarcrush.com/api4/public/creator/twitter/${screen_name}/posts/v1`, {
            headers: { "Authorization": `Bearer ${apiKey}` }
        });
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Internal Cache Endpoints ---

const CACHE_FILE = path.join(__dirname, 'server/cache/social_metrics.json');

app.get('/api/social-metrics/:brand', (req, res) => {
    const { brand } = req.params;

    if (!fs.existsSync(CACHE_FILE)) {
        return res.json({ error: "Cache not built yet" });
    }

    try {
        const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        const key = brand.toLowerCase();
        const data = cache[key];

        if (!data) {
            return res.json({ error: "Brand not tracked" });
        }

        res.json(data);
    } catch (e) {
        res.status(500).json({ error: "Cache read failed" });
    }
});

app.listen(PORT, () => {
    console.log(`\n🚀 Backend Proxy running at http://localhost:${PORT}`);
    console.log(`   - Endpoint: POST /api/generate-image`);
    console.log(`   - Auth: Parsing service-account.json...`);

    // Start Autonomous Agent
    startAgent();
});
