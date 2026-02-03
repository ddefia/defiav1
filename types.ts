
export type ImageSize = '1K' | '2K' | '4K';

export type AspectRatio = '16:9' | '1:1' | '4:5' | '9:16';

export interface BrandColor {
  id: string;
  hex: string;
  name: string;
}

export interface ReferenceImage {
  id: string;
  data?: string; // Base64 string
  url?: string; // Public URL (hosted)
  name: string;
  category?: string; // New: Grouping (e.g. "Product", "Logo")
}

export interface BrandConfig {
  colors: BrandColor[];
  referenceImages: ReferenceImage[];
  tweetExamples: string[]; // List of "Gold Standard" tweets for style
  knowledgeBase: string[]; // List of text content (docs/whitepapers)
  brandCollectorProfile?: any; // Optional: Raw enrichment profile from brand-collector
  name?: string; // New: Brand Name (injected from ID)
  ownerId?: string; // User ID who owns this brand
  voiceGuidelines?: string; // New: Tone/Voice instructions (e.g. "Formal, Trustworthy")
  targetAudience?: string; // New: Who is this for? (e.g. "Institutions")
  bannedPhrases?: string[]; // New: Words to never use
  visualIdentity?: string; // New: Distilled visual style guide from PDF/Docs
  approvedStyleExamples?: string[]; // New: Approved content examples from onboarding carousel
  rejectedStyleExamples?: string[]; // New: Rejected content examples (used to avoid style)
  // Brand Kit Page fields
  missionStatement?: string; // Company mission
  vision?: string; // Company vision
  founded?: string; // Year founded
  headquarters?: string; // HQ location
  toneGuidelines?: string; // Detailed tone guidelines
  tagline?: string; // Brand tagline
  brandDescription?: string; // Full brand description
  keywords?: string[]; // Keywords/topics for AI focus
  graphicTemplates?: {
    id: string;
    label: string;
    prompt: string;
    category?: string; // New: Grouping (e.g. "Giveaway", "Announcement")
    tweetExample?: string; // New: Example tweet content for context
    referenceImageIds?: string[]; // New: Link multiple reference images
    purpose?: string; // New: "High IQ" logic - Description of WHEN to use this template (e.g. "Use for technical deep dives")
  }[];
}

export interface GenerateImageParams {
  prompt: string; // The tweet text
  artPrompt?: string; // Optional visual specific prompt
  size: ImageSize;
  aspectRatio: AspectRatio;
  brandConfig: BrandConfig;
  brandName?: string; // Optional context for the model
  selectedReferenceImages?: string[]; // UPDATED: Specific reference images to use (Multi-Select)
  templateType?: string; // Type of template (Partnership, etc.)
  negativePrompt?: string; // Things to avoid in the image
  adhocAssets?: {
    data: string;
    mimeType: string;
  }[];
}

export interface GeneratedImage {
  url: string;
  timestamp: number;
}

export interface CampaignItem {
  id: string;
  tweet: string;
  artPrompt?: string; // Specific instruction for regeneration
  isApproved: boolean;
  approvalStatus?: 'draft' | 'review' | 'approved' | 'published';
  status: 'draft' | 'pending' | 'generating' | 'completed' | 'error';
  images: string[];
  selectedImageIndex?: number; // Index of the chosen image for scheduling
  campaignColor?: string; // Color code for the campaign
  template?: string; // The specific graphic template used for this item
  referenceImageId?: string; // Specific reference image override for this item
  skipImage?: boolean; // New: If true, skip image generation for this item
  reasoning?: string; // New: AI rationale for why this tweet was created
  visualHeadline?: string; // New: Short punchy text for graphic generation
  visualDescription?: string; // New: Art direction description
}

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm (local time)
  scheduledAt?: string; // ISO timestamp
  content: string;
  image?: string;
  platform: 'Twitter';
  status: 'scheduled' | 'published';
  approvalStatus?: 'approved' | 'published';
  campaignName?: string;
  color?: string; // Hex code or Tailwind class
  publishedAt?: string;
  platformPostId?: string;
  publishError?: string;
  publishAttempts?: number;
  lastPublishAttemptAt?: string;
  // New: Metadata for "Thinking" View
  reasoning?: string; // The "Thinking"
  visualDescription?: string; // The "Prompt"
  referenceImageId?: string; // The "Ref Photo"
  template?: string; // The "Rules" (implied by template type)
  visualHeadline?: string;
}

// --- STRATEGY BRAIN TYPES ---

export interface StrategyTask {
  id: string;
  type: 'GAP_FILL' | 'TREND_JACK' | 'CAMPAIGN_IDEA' | 'COMMUNITY' | 'REACTION' | 'REPLY' | 'EVERGREEN';
  title: string;
  description: string;
  reasoning: string;
  impactScore: number; // 1-10
  status?: 'pending' | 'approved' | 'dismissed';
  suggestedDate?: string;
  executionPrompt: string; // The prompt to send to the generator
  contextData?: TaskContextSource[]; // New: Evidence for the task
  contextSource?: TaskContextSource; // Single primary evidence
  reasoningSteps?: string[]; // New: Step-by-step logic chain
  sourceLogId?: string; // New: Link to the BrainLog that created this
  suggestedVisualTemplate?: string; // New: AI suggested graphic template
  suggestedReferenceIds?: string[]; // New: AI suggested reference images

  // NEW: Deep Strategy Fields
  strategicAlignment?: string; // Explanation of fit with Brand KB
  contentIdeas?: string[]; // 3 specific content angles

  // New: Proof & Footnotes
  logicExplanation?: string; // "Text explanation"
  proof?: string; // "Proof/Footnote"

  // Meta
  createdAt?: number;
  feedback?: 'approved' | 'dismissed' | 'neutral';
  feedbackAt?: number;
  feedbackNote?: string;
}

export interface TaskContextSource {
  type: 'TREND' | 'MENTION' | 'METRIC' | 'CALENDAR';
  source: string; // e.g. "CoinDesk", "@user_handle"
  headline: string; // e.g. "ETH hits $3k", "Tweet content"
  url?: string;
  relevance?: number;
}

// ... (Pulse/Trend types unchanged) ...

// ... (Growth Intelligence types unchanged) ...

export interface MarketingAction {
  type: 'TWEET' | 'THREAD' | 'CAMPAIGN' | 'REPLY';
  topic: string;
  goal: string;
  content: any; // Final output (JSON or String)
  reasoning?: string; // New: Why this specific action?
  hook?: string; // New: Punchy internal title
  strategicAlignment?: string; // New
  contentIdeas?: string[]; // New
}

export interface ActionPlan {
  analysis: AnalysisReport;
  actions: {
    type: 'TWEET' | 'THREAD' | 'CAMPAIGN' | 'REPLY';
    topic: string;
    goal: string;
    instructions: string;
    reasoning?: string; // New
    hook?: string; // New
    strategicAlignment?: string; // New
    contentIdeas?: string[]; // New
  }[];
}
// --- PULSE / TRENDS TYPES ---

export interface TrendItem {
  id: string;
  source: 'Twitter' | 'News' | 'OnChain' | 'LunarCrush';
  headline: string;
  summary: string;
  relevanceScore: number; // 1-100
  relevanceReason: string; // Explanation of why this matters to the brand
  sentiment: 'Positive' | 'Negative' | 'Neutral';
  url?: string;
  timestamp: string; // Display string (e.g. "10m ago")
  createdAt: number; // Machine timestamp for 48h expiry logic
  rawData?: any; // Full original payload for backend processing/debugging
  topic?: string; // New: High-level category (e.g. "AI", "GameFi")
}

export interface PulseCache {
  lastUpdated: number;
  items: TrendItem[];
}

// --- GROWTH INTELLIGENCE TYPES ---

export interface SocialPost {
  id: string;
  content: string;
  date: string;
  likes: number;
  comments: number;
  retweets: number;
  impressions: number;
  engagementRate: number;
  url?: string; // Link to actual tweet
  mediaUrl?: string; // Thumbnail/Image
}

export interface Mention {
  id: string;
  text: string;
  author: string;
  timestamp: string;
}

export interface SocialMetrics {
  totalFollowers: number;
  weeklyImpressions: number;
  engagementRate: number; // percentage
  mentions: number;
  recentMentions?: Mention[]; // New: Actual list of mentions
  topPost: string;
  recentPosts: SocialPost[];
  engagementHistory: { date: string; rate: number }[];
  comparison: {
    period: string; // 'vs Last Week'
    followersChange: number;
    engagementChange: number;
    impressionsChange: number;
  };
  isLive?: boolean;
  error?: string;
}

export interface LunarCrushCreator {
  id: string;
  name: string;
  screen_name: string;
  profile_image: string;
  followers: number;
  verified: boolean;
  url: string;
  interactions_24h: number;
  posts_24h: number;
  average_sentiment: number; // 0-100
  social_score: number;
}

export interface LunarCrushTimeSeriesItem {
  time: number; // Unix timestamp
  followers: number;
  interactions: number;
  posts: number;
  social_score: number;
}

export interface LunarCrushPost {
  id: string;
  body: string;
  post_link: string;
  sentiment: number;
  interactions: number; // likes + reposts + replies
  posted: number; // timestamp
}

export interface GrowthInput {
  contracts: {
    label: string;
    address: string;
    type: 'token' | 'staking' | 'pool' | 'nft';
  }[];
  duneApiKey?: string; // Integration point
  duneQueryIds?: {
    volume?: string;
    users?: string;
    retention?: string;
  };
  excludedWallets: string[];
  campaigns: CampaignLog[];
}

export interface CampaignLog {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  budget: number; // USD
  channel: string; // e.g., "Twitter", "Galxe", "Influencer"
}

export interface SocialSignals {
  sentimentScore: number; // 0-100
  sentimentTrend: 'up' | 'down' | 'stable';
  activeNarratives: string[];
  topKols: string[];
  trendingTopics?: TrendItem[]; // Added for dashboard visualization
}

export interface ComputedMetrics {
  totalVolume: number;
  netNewWallets: number;
  activeWallets: number;
  retentionRate: number; // Percentage
  tvlChange: number;
  campaignPerformance: {
    campaignId: string;
    lift: number; // Multiplier vs baseline
    cpa: number; // Cost Per Acquisition
    whalesAcquired: number;
    roi: number;
  }[];
}

export interface GrowthReport {
  executiveSummary: string; // Investor grade text
  tacticalPlan: string; // Specific actionable next steps
  strategicPlan: {
    action: 'KILL' | 'DOUBLE_DOWN' | 'OPTIMIZE';
    subject: string;
    reasoning: string;
  }[];
  metrics?: ComputedMetrics; // Optional if only social analysis is run
  lastUpdated?: number; // Timestamp for cache invalidation
}

export interface StrategicPosture {
  lastUpdated: number; // Unix timestamp
  version: string;
  objective: string;
  thesis: string;
  timeHorizon: string;
  confidenceLevel: 'High' | 'Medium' | 'Low';
  priorities: string[]; // "Mandates"
  deprioritized: string[]; // "Restricted"
  constraints: string[];
  marketEvidence: { label: string; value: string; signal: 'positive' | 'negative' | 'neutral' }[]; // New: Data backing
  changeLog: { date: string; change: string; reason: string }[];
}

export interface CampaignStrategy {
  targetAudience: string;
  strategicRationale: string; // Added to match Usage
  keyMessaging: string[];
  channelStrategy: { channel: string; focus: string; rationale: string }[];
  contentMix: string;
  visualStrategy: string; // Reasoning for visual choices
  estimatedResults: { impressions: string; engagement: string; conversions: string };
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}

export interface DefiaScore {
  total: number;
  grade: string;
  breakdown: {
    socialScore: number;
    chainScore: number;
    strategyScore: number;
  };
  insights: string[];
}

// --- BRAIN / LOGGING TYPES ---

export interface BrainLog {
  id: string;
  timestamp: number;
  type: 'STRATEGY' | 'REPLY' | 'CAMPAIGN' | 'RESEARCH' | 'ANALYSIS' | 'GROWTH_REPORT' | 'REACTION' | 'SYSTEM';
  brandId: string;
  context: string; // Brief summary of input context
  systemPrompt?: string; // The "Brain" instructions
  userPrompt?: string; // The specific trigger
  rawOutput?: string; // Full LLM response
  structuredOutput?: any; // Parsed JSON if applicable
  thoughts?: string; // AI Strategic Analysis / Monologue
  model: string;
  cost?: string; // Estimated token cost (optional placeholder)
}


// --- UNIFIED MARKETING BRAIN TYPES ---

export interface BrainContext {
  brand: BrandConfig;
  marketState: {
    trends: TrendItem[];
    analytics?: SocialMetrics;
    mentions?: Mention[];
  };
  memory: {
    ragDocs: string[];
    recentPosts: SocialPost[];
    pastStrategies: StrategyTask[];
  };
  userObjective: string;
}

export interface AgentInsight {
  agent: string;
  focus: string;
  summary: string;
  keySignals: string[];
}

export interface AnalysisReport {
  summary: string;
  keyThemes: string[];
  opportunities: string[];
  risks: string[];
  strategicAngle: string; // The "Big Idea"
}



// --- COPILOT / CHAT TYPES ---
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  intent?: ChatIntentResponse; // Associated structured data
  isThinking?: boolean;
  suggestedActions?: { label: string, action: string }[]; // New: Clickable options for the user
}

export type CopilotIntentType =
  | 'GENERAL_CHAT'
  | 'CREATE_CAMPAIGN'
  | 'GENERATE_IMAGE'
  | 'ANALYZE_MARKET'
  | 'DRAFT_CONTENT' // New: Quick content creation
  | 'MISSING_INFO'; // Needs follow-up

export interface ChatIntentResponse {
  type: CopilotIntentType;
  // Dynamic parameters based on type
  params?: {
    // Campaign Params
    campaignTopic?: string;
    campaignTheme?: string;

    // Image Params
    imagePrompt?: string;
    imageStyle?: string;
    imageAspectRatio?: AspectRatio;

    // Content Params
    contentTopic?: string; // New: For DRAFT_CONTENT

    // Analysis Params
    analysisTopic?: string;
  };
  missingInfo?: string[]; // Questions to ask user if incomplete
  thoughtProcess?: string; // AI reasoning for debug/UI
  uiCard?: 'CampaignCard' | 'ImageCard' | 'TrendCard'; // Hint for UI rendering
}

// --- DASHBOARD V2 TYPES ---

export interface KPIItem {
  label: string; // e.g. "Spend (7d)"
  value: string;
  delta: number; // Percentage
  trend: 'up' | 'down' | 'flat';
  confidence: 'High' | 'Med' | 'Low'; // Data quality
  statusLabel: 'Strong' | 'Watch' | 'Weak'; // Narrative label
  sparklineData: number[]; // 7d trend
}

export interface DashboardCampaign {
  id: string;
  name: string;
  channel: 'Twitter' | 'Telegram' | 'Discord' | 'Web' | 'Paid' | 'Influencer';
  spend: number;
  attributedWallets: number;
  cpa: number;
  retention: number; // %
  valueCreated: number; // $
  roi: number; // x
  status: 'Scale' | 'Test' | 'Pause' | 'Kill';

  // V2 New Fields
  trendSignal: 'up' | 'flat' | 'down';
  confidence: 'High' | 'Med' | 'Low';

  // Drawer/Decision Context
  aiSummary: string[];
  anomalies: string[];

  // New "Action Card" Fields
  priorityScore: number; // 0-10
  type: 'Alpha' | 'Evergreen' | 'Newsjack';
  expectedImpact: string;

  recommendation: {
    action: 'Scale' | 'Test' | 'Pause' | 'Kill';
    reasoning: string[];
    riskFactors?: string[]; // New
    confidence: 'High' | 'Med' | 'Low';
  };
  mediaUrl?: string; // New: Article/Post thumbnail
}

export interface CommunitySignal {
  platform: 'Twitter' | 'Discord' | 'Telegram';
  signal: string; // e.g. "Impressions ↓ after Jan 18"
  trend: 'up' | 'down' | 'flat';
  sentiment: 'Positive' | 'Negative' | 'Neutral';
}

export interface DailyBrief {
  keyDrivers: string[];
  decisionsReinforced: string[];
  risksAndUnknowns: string[];
  confidence: {
    level: 'High' | 'Medium' | 'Low';
    explanation: string;
  };
  timestamp: number;
}
