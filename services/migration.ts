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

            // 2. Migrate Strategy Tasks
            const tasks = loadStrategyTasks(brandId);
            if (tasks.length > 0) {
                const formattedTasks = tasks.map(t => ({
                    brand_id: brandId,
                    title: t.title || t.objective || "Untitled Strategy",
                    description: t.description || JSON.stringify(t),
                    status: t.status || 'pending',
                    impact_score: t.impact || 5, // Default fallback
                    created_at: t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString()
                }));

                const { error: taskError } = await supabase
                    .from('strategy_tasks')
                    .upsert(formattedTasks, { onConflict: 'brand_id, title' as any }); // Loose conflict matching or just insert

                if (taskError) {
                    // If conflict fails, try simple insert or ignore 
                    // ideally we'd have a stable ID, but local Tasks might not have UUIDs
                    report.errors.push(`Tasks ${brandId}: ${taskError.message}`);
                } else {
                    report.tasks += tasks.length;
                }
            }

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
