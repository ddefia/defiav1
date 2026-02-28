/**
 * Grant plan access to specific brands by updating their subscription
 * in the cloud-synced brand profiles (app_storage).
 *
 * Sets stripeSubscriptionId to 'manual_grant' which bypasses trial expiration,
 * and upgrades them to the growth plan with full limits.
 *
 * Usage: node scripts/grant_plan_access.mjs
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Brands to grant access to
const TARGET_BRANDS = ['Metis', 'ENKI Protocol', 'Netswap', 'LazAI'];

// Growth plan limits (matches services/subscription.ts)
const GROWTH_LIMITS = {
    maxBrands: 3,
    brainFrequencyHours: 6,
    contentPerMonth: 200,
    imagesPerMonth: 100,
    maxCampaigns: -1,
    maxCompetitors: 5,
    maxKnowledgeDocs: 25,
    onChainAnalytics: true,
    autoPublish: true,
    aiCopilot: true,
    maxTeamMembers: 1,
};

async function main() {
    console.log('Granting growth plan access to:', TARGET_BRANDS.join(', '));
    console.log('');

    // Step 1: Find brand owners (and fix missing owner_ids)
    const KNOWN_OWNER = '88197f4b-9c2a-410f-ab9f-0d5e6bda7355';

    const { data: brands, error: brandsErr } = await supabase
        .from('brands')
        .select('id, owner_id')
        .in('id', TARGET_BRANDS);

    if (brandsErr) {
        console.error('Failed to fetch brands:', brandsErr.message);
        process.exit(1);
    }

    if (!brands || brands.length === 0) {
        console.error('No brands found. Registered brand IDs:');
        const { data: all } = await supabase.from('brands').select('id');
        console.log(all?.map(b => b.id));
        process.exit(1);
    }

    // Fix missing owner_ids
    for (const brand of brands) {
        if (!brand.owner_id) {
            console.log(`  Fixing missing owner_id for ${brand.id}...`);
            await supabase.from('brands').update({ owner_id: KNOWN_OWNER }).eq('id', brand.id);
            brand.owner_id = KNOWN_OWNER;
        }
    }

    console.log(`Found ${brands.length} brands:`);
    brands.forEach(b => console.log(`  - ${b.id} (owner: ${b.owner_id})`));
    console.log('');

    // Step 2: Group brands by owner prefix
    const ownerBrands = {};
    for (const brand of brands) {
        if (!brand.owner_id) {
            console.warn(`  ⚠ ${brand.id} has no owner_id — skipping`);
            continue;
        }
        const prefix = brand.owner_id.slice(0, 8);
        if (!ownerBrands[prefix]) ownerBrands[prefix] = [];
        ownerBrands[prefix].push(brand.id);
    }

    // Step 3: Update each owner's brand profiles
    for (const [prefix, brandIds] of Object.entries(ownerBrands)) {
        const storageKey = `${prefix}_ethergraph_brand_profiles_v17`;
        console.log(`Loading profiles for owner prefix ${prefix}...`);

        const { data: row, error: loadErr } = await supabase
            .from('app_storage')
            .select('value')
            .eq('key', storageKey)
            .maybeSingle();

        if (loadErr) {
            console.error(`  Failed to load: ${loadErr.message}`);
            continue;
        }

        if (!row?.value) {
            console.warn(`  No brand profiles found for prefix ${prefix}`);
            continue;
        }

        const profiles = row.value;
        let updated = 0;

        for (const brandId of brandIds) {
            // Find the brand key (case-insensitive)
            const key = Object.keys(profiles).find(k => k.toLowerCase() === brandId.toLowerCase());
            if (!key) {
                console.warn(`  ⚠ Brand "${brandId}" not found in profiles`);
                continue;
            }

            const existing = profiles[key].subscription || {};
            profiles[key].subscription = {
                ...existing,
                plan: 'growth',
                limits: { ...GROWTH_LIMITS },
                usage: existing.usage || { contentThisMonth: 0, imagesThisMonth: 0, lastResetAt: Date.now() },
                stripeSubscriptionId: 'manual_grant',
                billingPeriod: 'monthly',
            };

            console.log(`  ✓ ${key}: granted growth plan (stripeSubscriptionId = 'manual_grant')`);
            updated++;
        }

        if (updated > 0) {
            const { error: saveErr } = await supabase
                .from('app_storage')
                .upsert({
                    key: storageKey,
                    value: profiles,
                    updated_at: new Date().toISOString(),
                });

            if (saveErr) {
                console.error(`  Failed to save: ${saveErr.message}`);
            } else {
                console.log(`  Saved ${updated} brand(s) for prefix ${prefix}`);
            }
        }
    }

    console.log('\nDone! The brands will pick up the new subscription on next page load (cloud sync).');
}

main().catch(e => { console.error(e); process.exit(1); });
