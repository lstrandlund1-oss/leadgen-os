// lib/profile/profileTypes.ts
// Defines all supported user profile types for Vantio Beta.
// Capabilities are now numeric depths (0-100):
//   0   = not offered
//   1-39  = light / supporting capability
//   40-69 = capable / reliable offering
//   70-89 = strong / primary service
//   90-100 = specialist / core differentiator

import type { UserProfileV1, CapabilityProfile } from "@/lib/types";
import type { Capability } from "@/lib/fit/needs";
import type { SellerType } from "@/lib/outreach/generateScript";

export type ProfileTypeKey =
  | "performance_marketer"
  | "web_developer"
  | "content_creator"
  | "seo_specialist"
  | "full_service_agency";

export type ProfileTypeDefinition = {
  key: ProfileTypeKey;
  label: string;
  description: string;
  sellerType: SellerType;
  defaultCapabilities: Record<Capability, number>;
  defaultProfile: Omit<UserProfileV1, "id" | "notes">;
};

export const PROFILE_TYPE_DEFINITIONS: Record<ProfileTypeKey, ProfileTypeDefinition> = {
  performance_marketer: {
    key: "performance_marketer",
    label: "Performance Marketer",
    description:
      "You run paid ads, build funnels, and drive measurable ROI for clients. Best leads have traffic potential but no conversion system.",
    sellerType: "MARKETING",
    defaultCapabilities: {
      ads: 90, // core differentiator
      tracking: 80, // strong — essential for performance work
      funnel: 75, // strong — conversion is your domain
      content: 25, // light — can do basics but not primary
      website: 15, // light — landing pages only
      seo: 20, // light — understands it, doesn't sell it
      crm: 30, // light — basic follow-up knowledge
    },
    defaultProfile: {
      niche: "general",
      serviceFocus: ["ads"],
      experienceLevel: "intermediate",
      targetBusinessSize: "small",
      acquisitionStyle: "volume",
      budgetPreference: "medium",
    },
  },

  web_developer: {
    key: "web_developer",
    label: "Web Developer / Designer",
    description:
      "You build websites, landing pages, and conversion infrastructure. Best leads have no website, outdated sites, or trust gap signals.",
    sellerType: "WEB_DEV",
    defaultCapabilities: {
      ads: 10, // not your domain
      tracking: 65, // capable — you wire up analytics and pixels
      funnel: 70, // strong — landing pages and conversion flows
      content: 25, // light — copywriting adjacent
      website: 95, // specialist — your core
      seo: 45, // capable — on-page SEO is part of good web work
      crm: 20, // light — basic integrations
    },
    defaultProfile: {
      niche: "general",
      serviceFocus: ["branding"],
      experienceLevel: "intermediate",
      targetBusinessSize: "small",
      acquisitionStyle: "balanced",
      budgetPreference: "medium",
    },
  },

  content_creator: {
    key: "content_creator",
    label: "Content Creator / Social Media Manager",
    description:
      "You create content, manage social media, and build organic audiences. Best leads have low social presence or underexposed quality.",
    sellerType: "CONTENT",
    defaultCapabilities: {
      ads: 20, // light — boosting posts, not full campaigns
      tracking: 25, // light — basic analytics awareness
      funnel: 15, // not primary
      content: 90, // specialist — your core
      website: 10, // not your domain
      seo: 35, // light — content SEO awareness
      crm: 15, // not your domain
    },
    defaultProfile: {
      niche: "general",
      serviceFocus: ["content"],
      experienceLevel: "intermediate",
      targetBusinessSize: "small",
      acquisitionStyle: "balanced",
      budgetPreference: "low",
    },
  },

  seo_specialist: {
    key: "seo_specialist",
    label: "SEO Specialist",
    description:
      "You improve search visibility, local SEO, and organic rankings. Best leads are local businesses with no search presence.",
    sellerType: "MARKETING",
    defaultCapabilities: {
      ads: 15, // not your domain
      tracking: 70, // strong — analytics is core to SEO work
      funnel: 25, // light — CRO adjacent
      content: 60, // capable — content strategy for SEO
      website: 35, // light — technical SEO touches
      seo: 92, // specialist — your core
      crm: 15, // not your domain
    },
    defaultProfile: {
      niche: "general",
      serviceFocus: ["seo"],
      experienceLevel: "intermediate",
      targetBusinessSize: "small",
      acquisitionStyle: "balanced",
      budgetPreference: "medium",
    },
  },

  full_service_agency: {
    key: "full_service_agency",
    label: "Full-Service Agency",
    description:
      "You offer a broad range of services and target businesses ready to scale. Best leads are higher-scoring businesses with budget and readiness.",
    sellerType: "MARKETING",
    defaultCapabilities: {
      ads: 80, // strong
      tracking: 80, // strong
      funnel: 75, // strong
      content: 70, // strong
      website: 65, // capable
      seo: 70, // strong
      crm: 55, // capable
    },
    defaultProfile: {
      niche: "general",
      serviceFocus: ["ads", "content", "seo"],
      experienceLevel: "advanced",
      targetBusinessSize: "medium",
      acquisitionStyle: "selective",
      budgetPreference: "high",
    },
  },
};

export const PROFILE_TYPE_KEYS = Object.keys(PROFILE_TYPE_DEFINITIONS) as ProfileTypeKey[];

export function getProfileTypeDefinition(key: ProfileTypeKey): ProfileTypeDefinition {
  return PROFILE_TYPE_DEFINITIONS[key];
}

export function buildUserProfile(
  id: string,
  typeKey: ProfileTypeKey,
  overrides?: Partial<Omit<UserProfileV1, "id">>,
): UserProfileV1 {
  const def = PROFILE_TYPE_DEFINITIONS[typeKey];
  return {
    id,
    ...def.defaultProfile,
    ...overrides,
  };
}

export function buildCapabilityProfile(
  id: string,
  typeKey: ProfileTypeKey,
  overrides?: Partial<Record<Capability, number>>,
): CapabilityProfile {
  const def = PROFILE_TYPE_DEFINITIONS[typeKey];
  return {
    id,
    capabilities: {
      ...def.defaultCapabilities,
      ...overrides,
    },
  };
}

export function isValidProfileTypeKey(key: string): key is ProfileTypeKey {
  return key in PROFILE_TYPE_DEFINITIONS;
}
