import { BrandConfig } from "../types";

// Brand profiles are now stored in Supabase (brand_configs table).
// This empty default ensures backward compatibility with storage.ts fallback logic.
export const DEFAULT_PROFILES: Record<string, BrandConfig> = {};
