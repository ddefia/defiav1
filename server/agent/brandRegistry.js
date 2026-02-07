// Fallback mapping for known brands (brand name -> Twitter handle)
const KNOWN_HANDLES = {
    'enki protocol': 'ENKIProtocol',
    'enki': 'ENKIProtocol',
    'netswap': 'netswapofficial',
    'lazai': 'LazAINetwork',
    'defia': 'DefiaLabs',
    'metis': 'MetisL2',
    'meme': 'MemecoinOrg',
    'arbitrum': 'arbitrum',
};

const normalizeForLookup = (name) => String(name || '').toLowerCase().trim();

export const fetchActiveBrands = async (supabase) => {
    if (!supabase) return [];

    try {
        // The brands table has id (brand name), config (JSON), and updated_at
        const { data: brands, error } = await supabase
            .from('brands')
            .select('id, config');

        if (error || !brands) {
            console.warn('[BrandRegistry] Failed to load brands:', error?.message);
            return [];
        }

        const brandIds = brands.map((brand) => brand.id);
        if (brandIds.length === 0) return [];

        // Try to fetch integration keys from app_storage
        const integrationKeys = [];
        for (const brandId of brandIds) {
            const key = `defia_integration_keys_${brandId}`;
            try {
                const { data } = await supabase
                    .from('app_storage')
                    .select('value')
                    .eq('key', key)
                    .maybeSingle();
                if (data?.value) {
                    integrationKeys.push({ brandId, ...data.value });
                }
            } catch (e) {
                // Ignore
            }
        }

        const integrationMap = new Map();
        integrationKeys.forEach((row) => {
            integrationMap.set(row.brandId, row);
        });

        return brands.map((brand) => {
            const integration = integrationMap.get(brand.id);

            // Extract xHandle from config if available
            const config = brand.config || {};
            const configXHandle = config.xHandle || config.twitterHandle || null;

            // Fallback to known handles mapping
            const knownHandle = KNOWN_HANDLES[normalizeForLookup(brand.id)];

            const xHandle = integration?.apify || configXHandle || knownHandle || null;

            console.log(`[BrandRegistry] Brand "${brand.id}" -> xHandle: ${xHandle}`);

            return {
                id: brand.id,
                name: brand.id, // id is the brand name
                xHandle,
                lunarSymbol: integration?.lunarcrush || null,
                config // Include config for additional context
            };
        });
    } catch (e) {
        console.error('[BrandRegistry] Unexpected error:', e);
        return [];
    }
};
