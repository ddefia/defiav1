import { BrandConfig } from "../types";

/**
 * HARDWIRED BRAND ASSETS
 * 
 * Instructions:
 * 1. For Hosted Images (Recommended): Use the 'url' field (e.g. "https://mysite.com/logo.png"). Ensure the server allows CORS.
 * 2. For Local Images: Convert to Base64 and paste into the 'data' field.
 * 3. To add documents: Paste text content into 'knowledgeBase'.
 */

// Placeholder for a transparent 1x1 pixel image if needed for testing
const PLACEHOLDER_IMG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export const DEFAULT_PROFILES: Record<string, BrandConfig> = {
    'ENKI': {
        colors: [
            { id: 'e_c_white', hex: '#FFFFFF', name: 'Stark White' },
            { id: 'e_c_orange', hex: '#D26625', name: 'Orange' },
            { id: 'e_c_gold', hex: '#D5A054', name: 'Yellow/Gold' },
            { id: 'e_c_red', hex: '#411D0E', name: 'Dark Red' },
        ],
        referenceImages: [
            { id: 'enki_templates_colored', name: 'Templates Colored', url: '/brands/enki/enki_templates_colored.png' },
            { id: 'G3Q-YQQWcAAUmuW', name: 'Reference 1', url: '/brands/enki/G3Q-YQQWcAAUmuW.jpg' },
            { id: 'G4O_AWLX0AAv-Qg', name: 'Reference 2', url: '/brands/enki/G4O_AWLX0AAv-Qg.png' },
            { id: 'G6H5INqWsAAPTeQ', name: 'Reference 3', url: '/brands/enki/G6H5INqWsAAPTeQ.png' },
            { id: 'G6dupMpXgAAEnuC', name: 'Reference 4', url: '/brands/enki/G6dupMpXgAAEnuC.jpg' },
            { id: 'G6uALu7W4AAq96g', name: 'Reference 5', url: '/brands/enki/G6uALu7W4AAq96g.jpg' },
            { id: 'enki-tweet-1764439512640-1', name: 'Tweet Ref 1', url: '/brands/enki/enki-tweet-1764439512640-1.png' },
            { id: 'enki-tweet-1764439619808-3', name: 'Tweet Ref 2', url: '/brands/enki/enki-tweet-1764439619808-3.png' }
        ],
        tweetExamples: [
            "The wait is finally over. 🧬\n\nMetis sequencing is evolving, and ENKI is leading the charge.\n\nWhy stake with us?\n• Simplified Sequencer access\n• Enhanced yield strategies\n• Full asset liquidity\n\nDon't just hold. Participate.\n\n👇 Start earning today:\n[Link]",
            "Security Audit: COMPLETED 🛡️\n\nWe are proud to announce that our smart contracts have passed the rigorous inspection of @Partner with 0 critical vulnerabilities.\n\nYour funds are SAFU.\n\nWhat's next?\n1. Mainnet Launch 🚀\n2. Genesis Airdrop 🪂\n3. Community Governance 🗳️\n\nRead the full report 🧵",
            "Governance power is in your hands. ✊\n\nThe $ENKI claim portal is officially LIVE.\n\nEligible users can now claim their tokens and start voting on the future of the protocol.\n\n✅ Check eligibility:\n[Link]\n\nLet's build the future of Metis together."
        ],
        knowledgeBase: [
            "ENKI is the first Liquid Staking Derivative (LSD) protocol on Metis Andromeda.",
            "ENKI aims to simplify participation in the Metis sequencer node ecosystem.",
            "Metis has implemented a decentralized sequencer pool, and ENKI is the gateway for average users to stake into it.",
            "The token ticker is $ENKI. It is used for governance and reward boosting.",
            // PASTE YOUR DOCUMENTS HERE AS STRINGS
            // "Full Whitepaper Section 1: ...",
            "Referenced Document: /docs/enki/enki_knowledge.pdf"
        ]
    },
    'Netswap': {
        colors: [
            { id: 'ns_white', hex: '#FFFFFF', name: 'White' },
            { id: 'ns_navy', hex: '#0A2252', name: 'Navy' },
            { id: 'ns_blue', hex: '#4B80F0', name: 'Netswap Blue' },
        ],
        referenceImages: [
            { id: 'netswap_promo_banner', name: 'Promo Banner', url: '/brands/netswap/netswap_promo_banner.png' },
            { id: 'G2hZnoMXkAAbUtD', name: 'Reference 1', url: '/brands/netswap/G2hZnoMXkAAbUtD.jpg' },
            { id: 'G4_zYWZXIAAqZh-', name: 'Reference 2', url: '/brands/netswap/G4_zYWZXIAAqZh-.jpg' },
            { id: 'G5cbMXXWkAA_zvu', name: 'Reference 3', url: '/brands/netswap/G5cbMXXWkAA_zvu.jpg' },
            { id: 'G68Ip8UXYAAeZP6', name: 'Reference 4', url: '/brands/netswap/G68Ip8UXYAAeZP6.jpg' },
            { id: 'G6KrX4NWgAIXseb', name: 'Reference 5', url: '/brands/netswap/G6KrX4NWgAIXseb.jpg' },
            { id: 'G6uGffSWUAAZC33', name: 'Reference 6', url: '/brands/netswap/G6uGffSWUAAZC33.jpg' },
            { id: 'GzkEIMtXUAEhLbo', name: 'Reference 7', url: '/brands/netswap/GzkEIMtXUAEhLbo.jpg' },
            { id: 'Gzr-f72WcAAkXsi', name: 'Reference 8', url: '/brands/netswap/Gzr-f72WcAAkXsi.jpg' },
            { id: 'RViwR9pP', name: 'Reference 9', url: '/brands/netswap/RViwR9pP.jpg' }
        ],
        tweetExamples: [
            "Liquidity Providers, assemble! 🚜\n\nThe NET/METIS pool rewards just went parabolic.\n\n💸 Current APR: 400%\n🔒 TVL: $2.5M\n⚡ Slippage: < 0.1%\n\nStop letting your assets sit idle. Make them work for you on the premier DEX of Metis.\n\nAdd liquidity now:\n[Link]",
            "Swap instantly. Low fees. Deep liquidity. 🌊\n\nExperience the most efficient trading engine on Metis.\n\nTrade now:\n[Link]",
        ],
        knowledgeBase: [
            "Netswap is the premier Decentralized Exchange (DEX) on the Metis network.",
            "Netswap features a launchpad, staking pools, and concentrated liquidity features.",
            "The governance token is $NET.",
            "Referenced Document: /docs/netswap/netswap_overview.pdf"
        ]
    },
    'Meme': {
        colors: [
            { id: 'm1', hex: '#FFFFFF', name: 'Impact White' },
            { id: 'm2', hex: '#000000', name: 'Outline Black' },
            { id: 'm3', hex: '#FF4500', name: 'Reddit Orange' },
            { id: 'm4', hex: '#00FF00', name: 'Terminal Green' },
        ],
        referenceImages: [],
        tweetExamples: [
            "wagmi frens 🚀",
            "imagine selling rn couldn't be me 🤡",
            "up only 📈"
        ],
        knowledgeBase: []
    },
    'LazAI': {
        colors: [
            { id: 'lz_1', hex: '#000000', name: 'Void Black' },
            { id: 'lz_2', hex: '#3B82F6', name: 'Electric Blue' },
            { id: 'lz_3', hex: '#10B981', name: 'AI Green' },
        ],
        referenceImages: [
            { id: 'lazai_ref_1', name: 'Reference 1', url: '/brands/lazai/lazai_ref_1.png' },
            { id: 'lazai_ref_2', name: 'Reference 2', url: '/brands/lazai/lazai_ref_2.png' }
        ],
        tweetExamples: [
            "Stop writing boilerplate. Start creating. 🧠\n\nLazAI v2.0 is live.\n\n- 10x faster generation\n- Context-aware workflows\n- Enterprise grade security\n\nThe future of work is automated.",
            "Your competitors are already using AI. Are you?\n\nDon't get left behind. #LazAI"
        ],
        knowledgeBase: [
            "LazAI is an AI-powered automation suite for content creators and marketers.",
            "Core features include automated blog writing, social media scheduling, and image generation.",
            "Target audience: Agencies, Freelancers, and Growth Hackers."
        ]
    },
    'Defia': {
        colors: [
            { id: 'df_1', hex: '#18181B', name: 'Zinc 900' },
            { id: 'df_2', hex: '#4F46E5', name: 'Indigo 600' },
            { id: 'df_3', hex: '#FAFAFA', name: 'Zinc 50' },
        ],
        referenceImages: [],
        tweetExamples: [
            "Design. Ship. Scale. 📐\n\nDefia Studio provides the infrastructure for decentralized brands to tell their story.",
            "Web3 marketing is broken. We fixed it.\n\nIntroducing the Growth Engine: Data-driven strategy for the on-chain era."
        ],
        knowledgeBase: [
            "Defia is a Web3-native creative studio and software suite.",
            "We build tools like the Defia Studio to help protocols manage their brand identity and growth.",
            "Our mission is to professionalize Web3 marketing."
        ]
    }
};
