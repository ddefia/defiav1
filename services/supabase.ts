import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase Environment Variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * LOG CONTENT HISTORY (Long-term Memory)
 */
export const logContentHistory = async (
    brandId: string,
    platform: 'twitter' | 'telegram',
    content: string,
    metrics?: any,
    url?: string,
    mediaUrl?: string
) => {
    try {
        const { error } = await supabase
            .from('content_logs')
            .insert({
                brand_id: brandId,
                platform,
                content,
                metrics,
                url,
                media_url: mediaUrl,
                posted_at: new Date().toISOString()
            });

        if (error) throw error;
        console.log(`[Supabase] Logged content for ${brandId}`);
    } catch (e) {
        console.error('[Supabase] Failed to log content:', e);
    }
};

/**
 * SAVE BRAIN MEMORY (RAG)
 */
export const saveBrainMemory = async (
    brandId: string,
    memoryType: 'DECISION' | 'INSIGHT' | 'FACT',
    content: string,
    vectorVal?: number[],
    metadata?: any
) => {
    try {
        const payload: any = {
            brand_id: brandId,
            memory_type: memoryType,
            content,
            metadata
        };

        if (vectorVal) {
            payload.embedding = vectorVal;
        }

        const { error } = await supabase
            .from('brain_memory')
            .insert(payload);

        if (error) throw error;
        console.log(`[Supabase] Saved brain memory: ${memoryType}`);
    } catch (e) {
        console.error('[Supabase] Failed to save memory:', e);
    }
};

/**
 * FETCH RELEVANT CONTEXT (Vector Search)
 * Note: Requires 'match_brain_memory' RPC function in DB
 */
export const searchBrainMemory = async (
    brandId: string,
    queryEmbedding: number[],
    threshold = 0.7,
    limit = 5
) => {
    try {
        const { data, error } = await supabase.rpc('match_brain_memory', {
            match_threshold: threshold,
            match_count: limit,
            query_embedding: queryEmbedding,
            filter_brand_id: brandId
        });

        if (error) throw error;
        return data;
    } catch (e) {
        console.error('[Supabase] Vector search failed:', e);
        return [];
    }
};
