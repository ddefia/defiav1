import { getEmbedding } from './gemini';
import { saveBrainLog, loadBrainLogs } from './storage'; // Local Fallback
import { supabase } from './supabase'; // Cloud

export interface RAGContext {
    id: number;
    content: string;
    source: string;
    metadata: any;
    similarity: number;
}

/**
 * RAG SERVICE
 * "The Memory Layer"
 */

export const ingestContext = async (content: string, source: string, metadata: any = {}, brandId?: string, ownerId?: string) => {
    if (!content || content.length < 5) return;

    // 1. Generate Embedding
    let embedding: number[] | null = null;
    try {
        embedding = await getEmbedding(content);
    } catch (e) {
        console.warn(`[RAG] Embedding failed for "${content.substring(0, 15)}...". Saving without vector.`);
        embedding = null;
    }

    if (embedding && embedding.length === 0) embedding = null;

    // 2. Deduplication Check
    // We don't want to store the exact same text twice.
    const { data: existing } = await supabase
        .from('brand_memory')
        .select('id')
        .eq('content', content)
        .eq('brand_id', brandId || null)
        .limit(1);

    if (existing && existing.length > 0) {
        // Already exists, maybe update timestamp? For now, skip.
        console.log(`[RAG] Skipping duplicate: "${content.substring(0, 20)}..."`);
        return;
    }

    // 3. Store in Supabase
    const { error } = await supabase
        .from('brand_memory')
        .insert({
            brand_id: brandId || null,
            owner_id: ownerId || null,
            content,
            source,
            metadata: { ...metadata, source },
            embedding
        });

    if (error) {
        console.error("RAG Ingestion Error:", error.message);
    } else {
        console.log(`[RAG] Ingested context from ${source}: "${content.substring(0, 30)}..."`);
    }
};

/**
 * Log a strategic decision into long-term memory.
 */
export const logDecision = async (action: string, reasoning: string, brandId?: string, ownerId?: string) => {
    const content = `DECISION TAKEN: ${action}. REASONING: ${reasoning}`;
    await ingestContext(content, 'AI_DECISION_LOG', { type: 'decision', timestamp: Date.now() }, brandId, ownerId);
};

export const searchContext = async (query: string, limit: number = 3, brandId?: string): Promise<RAGContext[]> => {
    // 1. Embed Query
    const embedding = await getEmbedding(query);
    if (!embedding || embedding.length === 0) return [];

    // 2. RPC call for cosine similarity (MATCHES DB SCHEMA)
    const { data, error } = await supabase.rpc('match_brand_memory', {
        query_embedding: embedding,
        match_threshold: 0.7, // Only relevant matches
        match_count: limit,
        filter_brand_id: brandId || null
    });

    if (error) {
        console.error("RAG Search Failed:", error.message);
        return [];
    }

    return data || [];
};

/**
 * Helper to optimize context for a prompt
 */
export const buildContextBlock = (contexts: RAGContext[]): string => {
    if (!contexts || contexts.length === 0) return "";

    return `
RELEVANT MARKET DATA (RAG MEMORY):
${contexts.map(c => `- [${c.source}] ${c.content}`).join('\n')}
    `.trim();
};

/**
 * DB MAINTENANCE: Backfill missing embeddings.
 * OPTIMIZED: Process in parallel batches for speed.
 */
export const indexEmptyEmbeddings = async (brandId?: string): Promise<number> => {
    if (!brandId) return 0;
    console.log(`[RAG] Starting FAST backfill for ${brandId}...`);

    // 1. Fetch larger batch (50)
    const { data: rows, error } = await supabase
        .from('brand_memory')
        .select('id, content')
        .eq('brand_id', brandId)
        .is('embedding', null)
        .limit(50);

    if (error) {
        console.error("Backfill Fetch Error:", error);
        throw error;
    }

    if (!rows || rows.length === 0) return 0;

    let successCount = 0;

    // 2. Parallel Processing (Batch of 5 concurrent)
    const processRow = async (row: any) => {
        if (!row.content) return;
        try {
            const embedding = await getEmbedding(row.content);
            if (embedding && embedding.length > 0) {
                const { error: updateError } = await supabase
                    .from('brand_memory')
                    .update({ embedding })
                    .eq('id', row.id);
                if (!updateError) successCount++;
            }
        } catch (e) {
            console.warn(`Failed to embed row ${row.id}`, e);
        }
    };

    // Chunk into groups of 5 to avoid rate limits
    const chunkSize = 5;
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        await Promise.all(chunk.map(processRow));
    }

    return successCount;
};
