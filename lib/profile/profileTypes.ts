// lib/profile/profileTypes.ts
// Defines all supported user profile types for Vantio Beta.
// Each type has a display name, description, default capabilities,
// default UserProfileV1 values, and a seller type mapping.

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
  defaultCapabilities: Record<Capability, number>; // 0=none, 1-100=depth
  defaultProfile: Omit<UserProfileV1, "id" | "notes">;
};

export const PROFILE_TYPE_DEFINITIONS: Record<
  ProfileTypeKey,
  ProfileTypeDefinition
> = {
  performance_marketer: {
    key: "performance_marketer",
    label: "Performance Marketer",
    description:
      "You run paid ads, build funnels, and drive measurable ROI for clients. Best leads have traffic potential but no conversion system.",
    sellerType: "MARKETING",
    defaultCapabilities: {
      ads: 90,
      tracking: 80,
      funnel: 80,
      content: 20,
      website: 20,
      seo: 10,
      crm: 30,
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
      ads: 0,
      tracking: 60,
      funnel: 70,
      content: 20,
      website: 95,
      seo: 30,
      crm: 10,
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
      ads: 20,
      tracking: 10,
      funnel: 10,
      content: 95,
      website: 10,
      seo: 30,
      crm: 0,
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
      ads: 10,
      tracking: 70,
      funnel: 20,
      content: 60,
      website: 30,
      seo: 95,
      crm: 10,
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
      "You offer a broad range of services and target businesses ready to scale. Configure your capability depths below to reflect where your team is strongest.",
    sellerType: "MARKETING",
    defaultCapabilities: {
      ads: 60,
      tracking: 60,
      funnel: 60,
      content: 60,
      website: 60,
      seo: 60,
      crm: 40,
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

export const PROFILE_TYPE_KEYS = Object.keys(
  PROFILE_TYPE_DEFINITIONS,
) as ProfileTypeKey[];

export function getProfileTypeDefinition(
  key: ProfileTypeKey,
): ProfileTypeDefinition {
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