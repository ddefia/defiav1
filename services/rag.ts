
import { supabase } from './supabaseClient';
import { generateEmbedding } from './gemini';

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

export const ingestContext = async (content: string, source: string, metadata: any = {}) => {
    if (!content || content.length < 5) return;

    // 1. Generate Embedding
    const embedding = await generateEmbedding(content);
    if (!embedding || embedding.length === 0) {
        console.warn("Skipping ingestion: No embedding generated.");
        return;
    }

    // 2. Deduplication Check
    // We don't want to store the exact same text twice.
    const { data: existing } = await supabase
        .from('marketing_context')
        .select('id')
        .eq('content', content)
        .limit(1);

    if (existing && existing.length > 0) {
        // Already exists, maybe update timestamp? For now, skip.
        console.log(`[RAG] Skipping duplicate: "${content.substring(0, 20)}..."`);
        return;
    }

    // 3. Store in Supabase
    const { error } = await supabase
        .from('marketing_context')
        .insert({
            content,
            source,
            metadata,
            embedding
        });

    if (error) {
        console.error("RAG Ingestion Error:", error.message);
    } else {
        console.log(`[RAG] Ingested context from ${source}: "${content.substring(0, 30)}..."`);
    }
};

export const searchContext = async (query: string, limit: number = 3): Promise<RAGContext[]> => {
    // 1. Embed Query
    const embedding = await generateEmbedding(query);
    if (!embedding || embedding.length === 0) return [];

    // 2. RPC call for cosine similarity
    const { data, error } = await supabase.rpc('match_marketing_context', {
        query_embedding: embedding,
        match_threshold: 0.7, // Only relevant matches
        match_count: limit
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
