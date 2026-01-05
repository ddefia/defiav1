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
    'ENKI Protocol': {
        colors: [
            { id: 'enki_1', hex: '#FFFFFF', name: 'Standard White' },
        ],
        referenceImages: [
            { id: 'enki_ref_0', name: 'Enki Reference 1', url: '/brands/enki/ref_0.png' },
            { id: 'enki_ref_1', name: 'Enki Reference 2', url: '/brands/enki/ref_1.png' },
            { id: 'enki_ref_2', name: 'Enki Reference 3', url: '/brands/enki/ref_2.png' },
            { id: 'enki_ref_3', name: 'Enki Reference 4', url: '/brands/enki/ref_3.jpg' },
            { id: 'enki_ref_4', name: 'Enki Reference 5', url: '/brands/enki/ref_4.png' }
        ],
        tweetExamples: [
            "We are simplifying the Metis Sequencer Node participation. 🌿\n\nNo technical headaches. Just pure yield.\n\n$ENKI is the key to unlocking the full potential of @MetisL2.\n\nStake your $METIS now: [Link]",
            "The era of decentralized sequencers is here.\n\nMetis x ENKI.\n\nIt's time to take control of the network.",
            "Did you know? You don't need to run a node to earn sequencer rewards.\n\nENKI does the heavy lifting for you.\n\nLiquid Staking for the people. 💧"
        ],
        knowledgeBase: [
            "ENKI aims to simplify participation in the Metis sequencer node ecosystem.",
            "Metis has implemented a decentralized sequencer pool, and ENKI is the gateway for average users to stake into it.",
            "The token ticker is $ENKI. It is used for governance and reward boosting.",
            // PASTE YOUR DOCUMENTS HERE AS STRINGS
            // "Full Whitepaper Section 1: ...",
            "Referenced Document: /docs/enki/enki_knowledge.pdf",
            `📘 ENKI Protocol – Full Knowledge Base

🔹 Introduction
ENKI Protocol is a liquid staking derivative/token (LST) platform built on Metis, the Layer 2 Ethereum rollup. It simplifies participation in Metis Sequencer Node staking, enabling any user—regardless of technical expertise or capital size—to earn yield on their METIS tokens. ENKI provides a non-custodial, DeFi-native solution that makes staking flexible, composable, and liquid, thus expanding accessibility and DeFi integration for the Metis ecosystem.

🔹 The Problem ENKI Solves
Running a Metis Sequencer Node requires technical expertise and high capital. ENKI removes these barriers by creating a liquid staking derivative model with a simplified process and composable assets.

🔹 System Architecture
1. eMetis (ENKI Metis): Pegged 1:1 to METIS, created upon deposit, used for DeFi composability.
2. seMetis (Staked eMetis): Represents staked eMetis, accrues yield from sequencer rewards.
3. ENKI Metis Minter: Converts METIS to eMetis and boosts sequencer nodes.

🔹 How Rewards Work
- 7-day epoch cycle aligned with Metis L1.
- Rewards: 90% to seMetis Yield Vault, 10% to Protocol Treasury.
- Redemption: 70% immediate, 30% vested (unlocks with ENKI staking).

🔹 Tokenomics
- ENKI Token: Governance + Utility (vesting unlock, redemption speed-up).
- Max Supply: 10M (minting cap protected by timelock).
- Allocation: 90% Community/Mining, 10% Marketing/Partners. Fair launch, no team alloc.

🔹 Key Features
- Liquid Staking (eMetis)
- Yield Vault (seMetis)
- Vesting & Reward Boosting (Stake ENKI to unlock full yield)
- Redemption Queue (Optional speed-up with ENKI)
- Governance (DAO)

🔹 Vesting Mechanism: Deep Dive (Updated May 2024)
- Immediate Access: 70% of value.
- Vested Portion: 30% locked for 90 days.
- Requirement: Stake 10 ENKI per 1 eMetis vested to unlock.
- Partial Staking: Users can partially unlock if they lack full ENKI coverage.
- Progressive Claiming: Rewards unlock linearly over time.

🔹 Protocol Architecture Components
- ENKI Metis Minter: Entry point (METIS -> eMetis).
- eMetis: ERC-20, pegged 1:1, redeemable.
- seMetis: ERC-20, value increases with yield.

🔹 Staking Lifecycle
1. Deposit METIS -> Receive eMetis.
2. Stake eMetis -> Receive seMetis.
3. Rewards accrue to seMetis value.
4. Unstake seMetis -> Receive eMetis (70% instant, 30% vested).

🔹 Redemption
- Queue-based eMetis -> METIS redemption.
- FIFO processing based on node availability.
- Fast redemption possible by locking ENKI.

🔹 Protocol Invariants
- 1 eMetis = 1 METIS backed.
- seMetis vault strictly solvent.
- ENKI supply capped at 10M.
- Yield split 90/10 fixed unless governed.`
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
            { id: 'lazai_ref_1', name: 'LazAI Reference 1', url: '/brands/lazai/lazai_ref_1.png' },
            { id: 'lazai_ref_2', name: 'LazAI Reference 2', url: '/brands/lazai/lazai_ref_2.png' },
            { id: 'lazai_ref_3', name: 'LazAI Reference 3', url: '/brands/lazai/lazai_ref_3.png' },
            { id: 'lazai_ref_4', name: 'LazAI Reference 4', url: '/brands/lazai/lazai_ref_4.png' },
            { id: 'lazai_ref_5', name: 'LazAI Reference 5', url: '/brands/lazai/lazai_ref_5.png' }
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
    },
    'Metis': {
        colors: [
            { id: 'metis_1', hex: '#00D2FF', name: 'Metis Cyan' },
            { id: 'metis_2', hex: '#000000', name: 'Black' },
            { id: 'metis_3', hex: '#FFFFFF', name: 'White' },
        ],
        referenceImages: [],
        tweetExamples: [
            "The first decentralized sequencer is live on mainnet. 🌿\n\nMetis is restoring the original promise of Ethereum scaling.\n\nDecentralization isn't a roadmap item. It's our foundation.",
            "Low fees. High speed. Community owned. 🚀\n\nBuild the future on Metis L2."
        ],
        knowledgeBase: [
            "Metis is a Smart Layer 2 Rollup on Ethereum.",
            "It is the first L2 to successfully decentralize its sequencer.",
            "Key features: Low gas fees, fast transactions, and community governance via Metro DAO."
        ]
    }
};
