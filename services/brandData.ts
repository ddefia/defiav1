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
            "Referenced Document: /docs/netswap/netswap_overview.pdf",
            `🔎 What is Netswap — High‑Level Overview
● Netswap is a decentralized exchange (DEX) built to run on the Metis Andromeda Layer‑2 network.
● It uses an automated market‑maker (AMM) model (Uniswap V2 style).
● Goal: Provide fast, cheap, and scalable DeFi services (swaps, liquidity, farming, launchpad) on Metis L2.

🧱 Architecture & Core Components
- Underlying Network: Metis Andromeda (Layer 2).
- AMM Model: No order book, trades against liquidity pools. 0.3% fee (0.25% to LPs, 0.05% to treasury).
- Smart Contracts: Non-custodial, open-source.

🔹 Key Modules
- Liquidity Pools: Users deposit token pairs to earn fees.
- Farming: Stake LP tokens for bonus rewards.
- Staking (NETT): Stake NETT for incentives, launchpad access (wNETT).
- Swap: Low friction token exchange.
- Launchpad V2: Platform for new project launches.
- Governance: NETT holders vote on proposals.

💱 Economics & Tokenomics: NETT
- Token: NETT (Governance + Utility).
- Utility: Staking, Launchpad access, Governance.
- Supply: Max 100M, circulating ~6M.
- Distribution: Community-focused (airdrops, farming, ecosystem rewards).

🌐 Use Cases
1. Token Swapping (fast/cheap).
2. Liquidity Provision (passive income).
3. Farming (yield maximization).
4. Staking NETT (governance/launchpad).
5. Launch Participation (IDOs).

🏗️ Why Netswap?
- L2 Cost/Speed Advantage (Metis).
- All-In-One DeFi Hub (Swap + Farm + Stake + Launch).
- Support for Metis-native & bridged tokens.
- Community Governance.

⚠️ Risks
- Liquidity depth on L2.
- Dependence on Metis network adoption.
- Smart contract risks (standard DeFi).
- Token volatility.

🔮 Vision
- Become the primary DeFi hub for Metis.
- Expand features: Limit Orders, Prediction Markets, NFT Marketplace, Leverage.
- Deepen community ownership via governance.`
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
            { id: 'lz_black', hex: '#000000', name: 'Void Black' },
            { id: 'lz_primary', hex: '#002682', name: 'LazAI' },
            { id: 'lz_sec', hex: '#405fe9', name: 'LazAI1' },
            { id: 'lz_white', hex: '#ffffff', name: 'LazAI2' },
            { id: 'lz_accent', hex: '#3b99fe', name: 'LazAI3' },
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
            "Target audience: Agencies, Freelancers, and Growth Hackers.",
            `📘 LazAI Network – Full Knowledge Base

🔹 Mission & Vision
LazAI is a Web3-native AI infrastructure protocol focused on verifiable AI + data ownership.
Mission: Build transparent, decentralized infrastructure where data, models, and agents are owned and verifiable.
Vision: A future where AI is human-aligned, trust-minimized, and community-governed.

🔹 Core Value Proposition
- Ownable AI assets via Data Anchoring Tokens (DATs).
- Verifiable AI behavior on-chain.
- Incentivized participation for data, compute, and governance.
- Composable AI agents built with Alith SDK.

🔹 Brand Pillars
1. Ownership: "AI should belong to those who build and train it."
2. Transparency: "AI must be auditable, verifiable, and trust-minimized."
3. Incentives: "Value creation should be rewarded at the protocol level."
4. Infrastructure First: "Applications change. Infrastructure lasts."

🔹 Core Primitives
1. DAT (Data Anchoring Token): The "AI asset" primitive. Represents ownership, usage rights, and value share of datasets/models.
2. Verified Computing (VC): The "trust layer". Ensures AI data and inference are authentic via TEE/ZK/Optimistic proofs.
3. Quorum-Based BFT (QBFT): AI-centric consensus validated by the iDAO.
4. Alith: Developer gateway and agent framework (Rust/Python/Node SDKs).

🔹 Architecture
- Execution: TEE (Verified Storage/Compute) -> Proof (ZK/Op) -> On-chain Verification -> Settlement.
- Privacy: Contributors mint DATs for private data, enabling privacy-preserving inference.

🔹 Network & Token
- Testnet Chain ID: 133718
- Currency: LAZAI
- Explorer: https://testnet-explorer.lazai.network

🔹 Target Audience
- Web3 Developers: Building on-chain agents.
- AI Builders: Seeking ownership and provenance.
- Crypto-Native Adopters: Interested in AI x Tokenomics.

🔹 Why LazAI?
Corrects the imbalance where centralized platforms profit from user data. Enables a new AI-native economy with on-chain incentives.`
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
