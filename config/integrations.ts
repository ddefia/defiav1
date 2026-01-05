export interface DuneConfig {
    volumeQueryId: string;
    usersQueryId: string;
    retentionQueryId: string;
}

export interface ApifyConfig {
    twitterHandle: string;
}

export interface IntegrationConfig {
    dune?: DuneConfig;
    apify?: ApifyConfig;
}

/**
 * Registry of Known Integrations for supported brands.
 * This allows the app to pre-fill configuration when a known brand is selected.
 */
export const KNOWN_INTEGRATIONS: Record<string, IntegrationConfig> = {
    'Enki': {
        dune: {
            volumeQueryId: '3339234', // Placeholder: Enki Protocol Volume
            usersQueryId: '3339235',  // Placeholder: Enki Users
            retentionQueryId: '3339236' // Placeholder: Enki Retention
        },
        apify: {
            twitterHandle: 'ENKIProtocol'
        }
    },
    'Netswap': {
        dune: {
            volumeQueryId: '3467812', // Placeholder
            usersQueryId: '3467813',
            retentionQueryId: '3467814'
        },
        apify: {
            twitterHandle: 'netswapofficial'
        }
    },
    'Meme': {
        dune: {
            volumeQueryId: '1234567',
            usersQueryId: '1234568',
            retentionQueryId: '1234569'
        },
        apify: {
            twitterHandle: 'MetisL2' // Fallback to ecosystem handle
        }
    },
    'Defia': {
        apify: {
            twitterHandle: 'DefiaLabs'
        }
    },
    'Metis': {
        dune: {
            volumeQueryId: '3339234',
            usersQueryId: '3339235',
            retentionQueryId: '3339236'
        },
        apify: {
            twitterHandle: 'MetisL2'
        }
    }
};

export const getIntegrationConfig = (brandName: string): IntegrationConfig | null => {
    // Case-insensitive lookup
    const key = Object.keys(KNOWN_INTEGRATIONS).find(k => k.toLowerCase() === brandName.toLowerCase());
    return key ? KNOWN_INTEGRATIONS[key] : null;
};
