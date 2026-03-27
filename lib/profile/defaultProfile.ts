import type { UserProfileV1, CapabilityProfile } from "@/lib/types";
import type { Capability } from "@/lib/fit/needs";

export const DEFAULT_USER_PROFILE_V1: UserProfileV1 = {
  id: "default_user_v1",
  niche: "real_estate",
  serviceFocus: ["ads", "content"],
  experienceLevel: "intermediate",
  targetBusinessSize: "small",
  acquisitionStyle: "volume",
  budgetPreference: "medium",
  notes: "Default Beta profile",
};

export const DEFAULT_CAPABILITY_PROFILE: CapabilityProfile = {
  id: "default_caps_v1",
  capabilities: {
    ads: 90,
    tracking: 80,
    funnel: 80,
    content: 70,
    website: 20,
    seo: 10,
    crm: 30,
  } satisfies Record<Capability, number>,
};