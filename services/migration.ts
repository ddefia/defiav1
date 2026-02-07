import { supabase } from './supabase';
import { loadBrandProfiles, loadStrategyTasks, loadBrainLogs } from './storage';

export const migrateToCloud = async () => {
    const report = {
        brands: 0,
        tasks: 0,
        logs: 0,
        errors: [] as string[]
    };

    try {
        // 1. Migrate Brands
        const profiles = loadBrandProfiles();
        const brandIds = Object.keys(profiles);

        for (const brandId of brandIds) {
            const config = profiles[brandId];

            // Upsert Brand Config
            const { error: brandError } = await supabase
                .from('brands')
                .upsert({
                    id: brandId,
                    config: config as any,
                    updated_at: new Date().toISOString()
                });

            if (brandError) {
                report.errors.push(`Brand ${brandId}: ${brandError.message}`);
                continue;
            }
            report.brands++;

            // 2. Strategy Tasks - stored via app_storage (strategy_tasks table may not exist)
            // Tasks are already persisted via saveStrategyTasks -> app_storage, so skip dedicated table migration

            // 3. Migrate Brain Logs (History) -> brain_memory
            // Note: We only migrate 'logs' that have valuable context
            const logs = loadBrainLogs(brandId);
            if (logs.length > 0) {
                // Filter for useful logs
                const memoryItems = logs.map(log => ({
                    brand_id: brandId,
                    memory_type: 'INSIGHT', // Default type for migrated logs
                    content: `[MIGRATED LOG] ${log.userPrompt} -> ${JSON.stringify(log.structuredOutput || log.rawOutput)}`,
                    metadata: { source: 'migration', original_ts: log.timestamp },
                    // No embedding for now, will need re-indexing later
                    created_at: new Date(log.timestamp || Date.now()).toISOString()
                }));

                const { error: logError } = await supabase
                    .from('brain_memory')
                    .insert(memoryItems);

                if (!logError) report.logs += logs.length;
            }
        }

        return { success: true, report };

    } catch (e: any) {
        return { success: false, error: e.message, report };
    }
};
