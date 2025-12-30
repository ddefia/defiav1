
import 'dotenv/config';

const COLORS = {
    GREEN: '\x1b[32m',
    RED: '\x1b[31m',
    YELLOW: '\x1b[33m',
    RESET: '\x1b[0m'
};

const main = async () => {
    console.log("🔍 Starting API Verification...\n");

    const checks = {
        APIFY: {
            key: process.env.APIFY_API_TOKEN,
            test: async (key) => {
                const res = await fetch(`https://api.apify.com/v2/users/me?token=${key}`);
                if (!res.ok) throw new Error(`Status ${res.status}`);
                const data = await res.json();
                return `Connected as ${data.data.username}`;
            }
        },
        DUNE: {
            key: process.env.DUNE_API_KEY,
            test: async (key) => {
                if (!key || key === 'your_dune_api_key_here') throw new Error("Placeholder Key");
                // Mock check for format
                if (key.length < 10) throw new Error("Key too short");
                return "Key Format Valid";
            }
        },
        LUNARCRUSH: {
            key: process.env.VITE_LUNARCRUSH_API_KEY || process.env.LUNARCRUSH_API_KEY,
            test: async (key) => {
                const res = await fetch(`https://lunarcrush.com/api4/public/coins/list/v1`, {
                    headers: { 'Authorization': `Bearer ${key}` }
                });
                if (!res.ok) throw new Error(`Status ${res.status}`);
                return "Connection Successful";
            }
        }
    };

    for (const [name, config] of Object.entries(checks)) {
        process.stdout.write(`Checking ${name}...\t`);
        if (!config.key) {
            console.log(`${COLORS.RED}MISSING${COLORS.RESET}`);
            continue;
        }

        try {
            const result = await config.test(config.key);
            console.log(`${COLORS.GREEN}OK${COLORS.RESET} (${result})`);
        } catch (e) {
            console.log(`${COLORS.RED}FAILED${COLORS.RESET} (${e.message})`);
        }
    }
};

main();
