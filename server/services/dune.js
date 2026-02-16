/**
 * Dune Analytics — Auto-generate SQL queries from contract addresses
 *
 * Creates 3 queries per brand (volume, users, retention) via Dune API,
 * so users only need a Dune API key — no SQL knowledge required.
 */

const DUNE_API_BASE = 'https://api.dune.com/api/v1';

// ── Chain → Dune schema mapping ──────────────────────────────────
const CHAIN_SCHEMAS = {
    'Ethereum': { schema: 'ethereum', native: 'ETH', priceChain: 'ethereum', type: 'evm' },
    'Polygon':  { schema: 'polygon',  native: 'MATIC', priceChain: 'polygon', type: 'evm' },
    'Arbitrum': { schema: 'arbitrum', native: 'ETH', priceChain: 'arbitrum', type: 'evm' },
    'Base':     { schema: 'base',     native: 'ETH', priceChain: 'base', type: 'evm' },
    'BSC':      { schema: 'bnb',      native: 'BNB', priceChain: 'bnb', type: 'evm' },
    'Metis':    { schema: 'metis_andromeda', native: 'METIS', priceChain: 'metis_andromeda', type: 'evm' },
    'Mantle':   { schema: 'mantle',   native: 'MNT', priceChain: 'mantle', type: 'evm' },
    'Optimism': { schema: 'optimism', native: 'ETH', priceChain: 'optimism', type: 'evm' },
    'Avalanche':{ schema: 'avalanche_c', native: 'AVAX', priceChain: 'avalanche_c', type: 'evm' },
    'Solana':   { schema: 'solana',   native: 'SOL', priceChain: 'solana', type: 'solana' },
};

// ── SQL Template Generators ──────────────────────────────────────

/**
 * Volume query — returns rows matching DuneVolumeRow: { block_time, amount_usd, tx_hash }
 */
function generateVolumeSQL(contractAddresses, chainInfo) {
    const addrList = contractAddresses.map(a => `'${a.toLowerCase()}'`).join(', ');

    if (chainInfo.type === 'solana') {
        return `
-- DEFIA Auto-Generated: Volume Query (Solana)
SELECT
    t.block_time,
    COALESCE(
        CAST(t.fee AS DOUBLE) / 1e9 * p.price,
        0
    ) AS amount_usd,
    t.id AS tx_hash,
    t.signer AS wallet_address
FROM solana.transactions t
LEFT JOIN prices.usd p
    ON p.blockchain = 'solana'
    AND p.symbol = 'SOL'
    AND p.minute = DATE_TRUNC('minute', t.block_time)
WHERE ARRAY_CONTAINS(t.account_keys, ${contractAddresses.map(a => `'${a}'`).join(') OR ARRAY_CONTAINS(t.account_keys, ')})
    AND t.block_time >= NOW() - INTERVAL '30' DAY
    AND t.success = true
ORDER BY t.block_time DESC
LIMIT 10000
`.trim();
    }

    // EVM chains
    return `
-- DEFIA Auto-Generated: Volume Query (${chainInfo.schema})
SELECT
    t.block_time,
    COALESCE(
        CAST(t.value AS DOUBLE) / 1e18 * p.price,
        0
    ) AS amount_usd,
    t.hash AS tx_hash,
    t."from" AS wallet_address
FROM ${chainInfo.schema}.transactions t
LEFT JOIN prices.usd p
    ON p.blockchain = '${chainInfo.priceChain}'
    AND p.symbol = '${chainInfo.native}'
    AND p.minute = DATE_TRUNC('minute', t.block_time)
WHERE t."to" IN (${addrList})
    AND t.block_time >= NOW() - INTERVAL '30' DAY
    AND t.success = true
ORDER BY t.block_time DESC
LIMIT 10000
`.trim();
}

/**
 * Users query — returns rows matching DuneUserRow: { wallet_address, first_seen, last_seen, tx_count }
 */
function generateUsersSQL(contractAddresses, chainInfo) {
    const addrList = contractAddresses.map(a => `'${a.toLowerCase()}'`).join(', ');

    if (chainInfo.type === 'solana') {
        return `
-- DEFIA Auto-Generated: Users Query (Solana)
SELECT
    t.signer AS wallet_address,
    MIN(t.block_time) AS first_seen,
    MAX(t.block_time) AS last_seen,
    COUNT(*) AS tx_count
FROM solana.transactions t
WHERE ARRAY_CONTAINS(t.account_keys, ${contractAddresses.map(a => `'${a}'`).join(') OR ARRAY_CONTAINS(t.account_keys, ')})
    AND t.block_time >= NOW() - INTERVAL '90' DAY
    AND t.success = true
GROUP BY t.signer
ORDER BY tx_count DESC
LIMIT 50000
`.trim();
    }

    // EVM chains
    return `
-- DEFIA Auto-Generated: Users Query (${chainInfo.schema})
SELECT
    t."from" AS wallet_address,
    MIN(t.block_time) AS first_seen,
    MAX(t.block_time) AS last_seen,
    COUNT(*) AS tx_count
FROM ${chainInfo.schema}.transactions t
WHERE t."to" IN (${addrList})
    AND t.block_time >= NOW() - INTERVAL '90' DAY
    AND t.success = true
GROUP BY t."from"
ORDER BY tx_count DESC
LIMIT 50000
`.trim();
}

/**
 * Retention query — returns rows matching DuneRetentionRow: { week, cohort_size, retained_users, retention_rate }
 */
function generateRetentionSQL(contractAddresses, chainInfo) {
    const addrList = contractAddresses.map(a => `'${a.toLowerCase()}'`).join(', ');

    if (chainInfo.type === 'solana') {
        return `
-- DEFIA Auto-Generated: Retention Query (Solana)
WITH first_activity AS (
    SELECT
        t.signer AS wallet,
        DATE_TRUNC('week', MIN(t.block_time)) AS cohort_week
    FROM solana.transactions t
    WHERE ARRAY_CONTAINS(t.account_keys, ${contractAddresses.map(a => `'${a}'`).join(') OR ARRAY_CONTAINS(t.account_keys, ')})
        AND t.block_time >= NOW() - INTERVAL '90' DAY
        AND t.success = true
    GROUP BY t.signer
),
weekly_activity AS (
    SELECT
        t.signer AS wallet,
        DATE_TRUNC('week', t.block_time) AS activity_week
    FROM solana.transactions t
    WHERE ARRAY_CONTAINS(t.account_keys, ${contractAddresses.map(a => `'${a}'`).join(') OR ARRAY_CONTAINS(t.account_keys, ')})
        AND t.block_time >= NOW() - INTERVAL '90' DAY
        AND t.success = true
    GROUP BY t.signer, DATE_TRUNC('week', t.block_time)
)
SELECT
    fa.cohort_week AS week,
    COUNT(DISTINCT fa.wallet) AS cohort_size,
    COUNT(DISTINCT wa.wallet) AS retained_users,
    ROUND(100.0 * COUNT(DISTINCT wa.wallet) / NULLIF(COUNT(DISTINCT fa.wallet), 0), 2) AS retention_rate
FROM first_activity fa
LEFT JOIN weekly_activity wa
    ON fa.wallet = wa.wallet
    AND wa.activity_week > fa.cohort_week
GROUP BY fa.cohort_week
ORDER BY fa.cohort_week DESC
LIMIT 12
`.trim();
    }

    // EVM chains
    return `
-- DEFIA Auto-Generated: Retention Query (${chainInfo.schema})
WITH first_activity AS (
    SELECT
        t."from" AS wallet,
        DATE_TRUNC('week', MIN(t.block_time)) AS cohort_week
    FROM ${chainInfo.schema}.transactions t
    WHERE t."to" IN (${addrList})
        AND t.block_time >= NOW() - INTERVAL '90' DAY
        AND t.success = true
    GROUP BY t."from"
),
weekly_activity AS (
    SELECT
        t."from" AS wallet,
        DATE_TRUNC('week', t.block_time) AS activity_week
    FROM ${chainInfo.schema}.transactions t
    WHERE t."to" IN (${addrList})
        AND t.block_time >= NOW() - INTERVAL '90' DAY
        AND t.success = true
    GROUP BY t."from", DATE_TRUNC('week', t.block_time)
)
SELECT
    fa.cohort_week AS week,
    COUNT(DISTINCT fa.wallet) AS cohort_size,
    COUNT(DISTINCT wa.wallet) AS retained_users,
    ROUND(100.0 * COUNT(DISTINCT wa.wallet) / NULLIF(COUNT(DISTINCT fa.wallet), 0), 2) AS retention_rate
FROM first_activity fa
LEFT JOIN weekly_activity wa
    ON fa.wallet = wa.wallet
    AND wa.activity_week > fa.cohort_week
GROUP BY fa.cohort_week
ORDER BY fa.cohort_week DESC
LIMIT 12
`.trim();
}

// ── Dune API Client ──────────────────────────────────────────────

/**
 * Create a query on Dune. Returns the query_id.
 * Requires Dune Analyst plan or higher.
 */
async function createDuneQuery(apiKey, name, sql) {
    const response = await fetch(`${DUNE_API_BASE}/query`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-DUNE-API-KEY': apiKey,
        },
        body: JSON.stringify({
            name,
            query_sql: sql,
            is_private: true,
        }),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        if (response.status === 401) throw new Error('Invalid Dune API key');
        if (response.status === 402) throw new Error('Dune Analyst plan or higher required to create queries via API');
        if (response.status === 429) throw new Error('Dune API rate limited — try again in a few minutes');
        throw new Error(`Dune create query failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    return String(data.query_id);
}

/**
 * Execute a query on Dune to prime the result cache.
 * Returns the execution_id. Results won't be ready immediately.
 */
async function executeDuneQuery(apiKey, queryId) {
    const response = await fetch(`${DUNE_API_BASE}/query/${queryId}/execute`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-DUNE-API-KEY': apiKey,
        },
        body: JSON.stringify({}),
    });

    if (!response.ok) {
        console.warn(`[Dune] Failed to execute query ${queryId}: ${response.status}`);
        return null;
    }

    const data = await response.json();
    return data.execution_id || null;
}

// ── Orchestrator ─────────────────────────────────────────────────

/**
 * Generate and create all 3 Dune queries for a brand's contracts.
 * Groups contracts by chain, generates SQL, creates queries on Dune, executes them.
 *
 * @returns {{ volume?: string, users?: string, retention?: string }} query IDs
 */
async function generateAndCreateQueries(apiKey, contracts, brandName) {
    // Group contracts by chain
    const byChain = {};
    for (const contract of contracts) {
        const chain = contract.chain || 'Ethereum';
        const chainInfo = CHAIN_SCHEMAS[chain];
        if (!chainInfo) {
            console.warn(`[Dune] Unsupported chain: ${chain} — skipping`);
            continue;
        }
        if (!byChain[chain]) byChain[chain] = { chainInfo, addresses: [] };
        byChain[chain].addresses.push(contract.address);
    }

    const supportedChains = Object.keys(byChain);
    if (supportedChains.length === 0) {
        throw new Error('No supported chains found in contracts');
    }

    // For now, use the first chain group for query generation.
    // Multi-chain UNION queries can be added later.
    // If brand has contracts on multiple chains, we generate for the chain with the most contracts.
    const primaryChain = supportedChains.reduce((best, chain) =>
        byChain[chain].addresses.length > byChain[best].addresses.length ? chain : best
    , supportedChains[0]);

    const { chainInfo, addresses } = byChain[primaryChain];
    const prefix = `DEFIA_${brandName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}`;

    const result = { volume: undefined, users: undefined, retention: undefined };

    // Create queries sequentially (respect Dune rate limits)
    try {
        const volumeSQL = generateVolumeSQL(addresses, chainInfo);
        result.volume = await createDuneQuery(apiKey, `${prefix}_Volume`, volumeSQL);
        console.log(`[Dune] Created volume query: ${result.volume}`);
    } catch (e) {
        console.warn(`[Dune] Failed to create volume query:`, e.message);
    }

    try {
        const usersSQL = generateUsersSQL(addresses, chainInfo);
        result.users = await createDuneQuery(apiKey, `${prefix}_Users`, usersSQL);
        console.log(`[Dune] Created users query: ${result.users}`);
    } catch (e) {
        console.warn(`[Dune] Failed to create users query:`, e.message);
    }

    try {
        const retentionSQL = generateRetentionSQL(addresses, chainInfo);
        result.retention = await createDuneQuery(apiKey, `${prefix}_Retention`, retentionSQL);
        console.log(`[Dune] Created retention query: ${result.retention}`);
    } catch (e) {
        console.warn(`[Dune] Failed to create retention query:`, e.message);
    }

    // Fire executions to prime cache (don't await results — they take time)
    const queryIds = [result.volume, result.users, result.retention].filter(Boolean);
    for (const qid of queryIds) {
        executeDuneQuery(apiKey, qid).catch(() => null);
    }

    // Return whatever succeeded
    if (!result.volume && !result.users && !result.retention) {
        throw new Error('All query creations failed');
    }

    return result;
}

export {
    CHAIN_SCHEMAS,
    generateVolumeSQL,
    generateUsersSQL,
    generateRetentionSQL,
    createDuneQuery,
    executeDuneQuery,
    generateAndCreateQueries,
};
