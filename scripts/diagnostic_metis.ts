
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fwvqrdxgcugullcwkfiq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dn_SxJbbX9sIYjCiR9paTw_MRMnokPf';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runDiagnostic() {
    console.log("--- METIS BRAND DIAGNOSTIC ---");

    // 1. Total Count
    const { count: total, error: countErr } = await supabase
        .from('brain_memory')
        .select('id', { count: 'exact', head: true })
        .ilike('brand_id', 'Metis');

    // 2. Missing Embeddings
    const { count: missing, error: missingErr } = await supabase
        .from('brain_memory')
        .select('id', { count: 'exact', head: true })
        .ilike('brand_id', 'Metis')
        .is('embedding', null);

    // 3. With Media
    // Cannot do complex JSON path count efficiently in client, but can check non-null count if mapped?
    // Metadata is JSONB. We can't easy count mediaUrl != null without fetching all or using RPC.
    // We'll fetch a sample.

    console.log(`Total History Items: ${total}`);
    console.log(`Missing Embeddings:  ${missing}`);
    console.log(`Indexed Items:       ${(total || 0) - (missing || 0)}`);
    console.log(`Completion:          ${(((total || 0) - (missing || 0)) / (total || 1) * 100).toFixed(1)}%`);

    if (missing! > 0) {
        console.log("\nESTIMATED TIME TO INDEX (via Browser):");
        console.log(`At 20 items / 10s:  ~${Math.ceil((missing || 0) / 120)} minutes`);
    } else {
        console.log("\n✅ ALL DATA INDEXED.");
    }

    console.log("\n--- EFFICIENCY ANALYSIS ---");
    console.log("Current Method: Client-Side Batching (Safe, Slow)");
    console.log("Proposed Method for Mass Data: Local Node Script (Fast, No Timeouts)");
}

runDiagnostic();
