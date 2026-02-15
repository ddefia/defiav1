import { GrowthReport, SocialMetrics } from "../types";
import { getAuthToken } from './auth';

export interface ActionCenterDecision {
    id: string;
    timestamp?: string;
    brandId?: string;
    action?: string;
    targetId?: string;
    reason?: string;
    draft?: string;
    status?: string;
}

export interface ActionCenterPayload {
    brand: string;
    decisions: ActionCenterDecision[];
    growthReport?: GrowthReport;
    socialMetrics?: SocialMetrics | { error?: string };
    generatedAt: string;
}

export const fetchActionCenter = async (brandName: string): Promise<ActionCenterPayload | null> => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    try {
        const token = await getAuthToken();
        const response = await fetch(`${baseUrl}/api/action-center/${encodeURIComponent(brandName)}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.warn("[ActionCenter] Fetch failed", e);
        return null;
    }
};
