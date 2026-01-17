
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
  voiceGuidelines?: string; // New: Tone/Voice instructions (e.g. "Formal, Trustworthy")
  targetAudience?: string; // New: Who is this for? (e.g. "Institutions")
  bannedPhrases?: string[]; // New: Words to never use
  visualIdentity?: string; // New: Distilled visual style guide from PDF/Docs
  graphicTemplates?: {
    id: string;
    label: string;
    prompt: string;
    category?: string; // New: Grouping (e.g. "Giveaway", "Announcement")
    tweetExample?: string; // New: Example tweet content for context
    referenceImageIds?: string[]; // New: Link multiple reference images
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
  content: string;
  image?: string;
  platform: 'Twitter';
  status: 'scheduled' | 'published';
  campaignName?: string;
  color?: string; // Hex code or Tailwind class
}

// --- STRATEGY BRAIN TYPES ---

export interface StrategyTask {
  id: string;
  type: 'GAP_FILL' | 'TREND_JACK' | 'CAMPAIGN_IDEA' | 'COMMUNITY' | 'REACTION' | 'REPLY' | 'EVERGREEN';
  title: string;
  description: string;
  reasoning: string;
  impactScore: number; // 1-10
  suggestedDate?: string;
  executionPrompt: string; // The prompt to send to the generator
  contextData?: TaskContextSource[]; // New: Evidence for the task
  reasoningSteps?: string[]; // New: Step-by-step logic chain
  sourceLogId?: string; // New: Link to the BrainLog that created this
  suggestedVisualTemplate?: string; // New: AI suggested graphic template
  suggestedReferenceIds?: string[]; // New: AI suggested reference images
}

export interface TaskContextSource {
  type: 'TREND' | 'MENTION' | 'METRIC' | 'CALENDAR';
  source: string; // e.g. "CoinDesk", "@user_handle"
  headline: string; // e.g. "ETH hits $3k", "Tweet content"
  url?: string;
  relevance?: number;
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
}

export interface CampaignStrategy {
  targetAudience: string;
  strategicRationale: string; // Added to match Usage
  keyMessaging: string[];
  channelStrategy: { channel: string; focus: string; rationale: string }[];
  contentMix: string;
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

export interface AnalysisReport {
  summary: string;
  keyThemes: string[];
  opportunities: string[];
  risks: string[];
  strategicAngle: string; // The "Big Idea"
}

export interface MarketingAction {
  type: 'TWEET' | 'THREAD' | 'CAMPAIGN' | 'REPLY';
  topic: string;
  goal: string;
  content: any; // Final output (JSON or String)
}

export interface ActionPlan {
  analysis: AnalysisReport;
  actions: {
    type: 'TWEET' | 'THREAD' | 'CAMPAIGN' | 'REPLY';
    topic: string;
    goal: string;
    instructions: string;
  }[];
}
