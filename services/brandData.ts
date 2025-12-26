import { BrandConfig } from "../types";

/**
 * HARDWIRED BRAND ASSETS
 * 
 * Instructions:
 * 1. For Hosted Images (Recommended): Use the 'url' field (e.g. "https://mysite.com/logo.png"). Ensure the server allows CORS.
 * 2. For Local Images: Convert to Base64 and paste into the 'data' field.
 * 3. To add documents: Paste text content into 'knowledgeBase'.
 */

// Placeholder for a transparent 1x1 pixel image if needed for testing
const PLACEHOLDER_IMG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export const DEFAULT_PROFILES: Record<string, BrandConfig> = {
    // Default profiles removed to enforce user-configured or authentic data.
    // Use the "Connect" flow in the UI to add brands.
};
