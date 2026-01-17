import { createClient } from '@supabase/supabase-js';

// Hardcoded for debugging
const supabaseUrl = 'https://fwvqrdxgcugullcwkfiq.supabase.co';
const supabaseKey = 'sb_publishable_dn_SxJbbX9sIYjCiR9paTw_MRMnokPf';
const supabase = createClient(supabaseUrl, supabaseKey);

// --- COPIED FROM STORAGE.TS ---
const parseSocialDate = (dateVal: any, createdAt: string): string => {
    try {
        if (!dateVal) return new Date(createdAt).toISOString().split('T')[0];

        // Handle Twitter Format: "Fri Jan 12 21:00:00 +0000 2026"
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
            return d.toISOString().split('T')[0];
        }

        console.warn(`[History] Date parse failed for: ${dateVal}, falling back to ${createdAt}`);
        return new Date(createdAt).toISOString().split('T')[0];
    } catch (e) {
        return new Date().toISOString().split('T')[0];
    }
};

async function verifyLogic() {
    const dbBrandId = 'Metis';
    console.log(`Fetching history for ${dbBrandId}...`);

    const { data } = await supabase
        .from('brain_memory')
        .select('id, content, created_at, metadata')
        .eq('brand_id', dbBrandId)
        .not('content', 'ilike', '%MIGRATED LOG%')
        .order('created_at', { ascending: false })
        .limit(500);

    if (!data) {
        console.log("No data found.");
        return;
    }

    console.log(`Raw DB count: ${data.length}`);

    // JS Filter (Same as storage.ts)
    const validData = data.filter((item: any) => {
        const isSocial = item.metadata?.type === 'social_history';
        const isTweet = (item.content || "").toString().startsWith('Tweet by');
        const isMigratedLog = (item.content || "").toString().includes("MIGRATED LOG");
        return (isSocial || isTweet) && !isMigratedLog;
    });

    console.log(`Valid Data count after JS filter: ${validData.length}`);

    const events = validData.map((item: any) => {
        const dateStr = parseSocialDate(item.metadata?.date, item.created_at);
        const mediaUrl = item.metadata?.mediaUrl || undefined;

        let displayContent = item.content;
        if (item.content.startsWith('Tweet by @')) {
            const parts = item.content.split(': "');
            if (parts.length > 1) {
                displayContent = parts.slice(1).join(': "').slice(0, -1);
            }
        }

        return {
            id: `history-${item.id}`,
            date: dateStr,
            title: displayContent.substring(0, 30),
            image: mediaUrl ? "[IMAGE]" : undefined
        };
    });

    // Stats
    const dateCounts: Record<string, number> = {};
    events.forEach(e => {
        dateCounts[e.date] = (dateCounts[e.date] || 0) + 1;
    });

    console.log("\n--- Event Distribution ---");
    console.log(dateCounts);

    console.log("\n--- Sample Events ---");
    events.slice(0, 5).forEach(e => console.log(e));
}

verifyLogic();
