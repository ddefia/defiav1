import { BrandConfig } from "../types";
import brandProfiles from "../data/brandProfiles.json";

export const DEFAULT_PROFILES: Record<string, BrandConfig> =
    brandProfiles as Record<string, BrandConfig>;
