export const fetchActiveBrands = async (supabase) => {
    if (!supabase) return [];

    try {
        const { data: brands, error } = await supabase
            .from('brands')
            .select('id, owner_id, name');

        if (error || !brands) {
            console.warn('[BrandRegistry] Failed to load brands:', error?.message);
            return [];
        }

        const brandIds = brands.map((brand) => brand.id);
        if (brandIds.length === 0) return [];

        const { data: sources } = await supabase
            .from('brand_sources')
            .select('brand_id, source_type, normalized_value, value')
            .in('brand_id', brandIds);

        const { data: integrations } = await supabase
            .from('brand_integrations')
            .select('brand_id, apify_handle, lunarcrush_symbol')
            .in('brand_id', brandIds);

        const sourceMap = new Map();
        (sources || []).forEach((source) => {
            if (!sourceMap.has(source.brand_id)) {
                sourceMap.set(source.brand_id, []);
            }
            sourceMap.get(source.brand_id).push(source);
        });

        const integrationMap = new Map();
        (integrations || []).forEach((row) => {
            integrationMap.set(row.brand_id, row);
        });

        return brands.map((brand) => {
            const brandSources = sourceMap.get(brand.id) || [];
            const handleSource = brandSources.find((entry) => entry.source_type === 'x_handle');
            const integration = integrationMap.get(brand.id);

            return {
                id: brand.id,
                ownerId: brand.owner_id || null,
                name: brand.name,
                xHandle: integration?.apify_handle || handleSource?.normalized_value || handleSource?.value || null,
                lunarSymbol: integration?.lunarcrush_symbol || null
            };
        });
    } catch (e) {
        console.error('[BrandRegistry] Unexpected error:', e);
        return [];
    }
};
