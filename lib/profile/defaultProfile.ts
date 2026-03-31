import type { UserProfileV1, CapabilityProfile } from "@/lib/types";
import type { Capability } from "@/lib/fit/needs";

export const DEFAULT_USER_PROFILE_V1: UserProfileV1 = {
  id: "default_user_v1",
  niche: "general",
  serviceFocus: ["ads", "content"],
  experienceLevel: "intermediate",
  targetBusinessSize: "small",
  acquisitionStyle: "balanced",
  budgetPreference: "medium",
  notes: "Default Beta profile",
};

// Default capabilities — balanced generalist
// Users should update these in their profile settings
export const DEFAULT_CAPABILITY_PROFILE: CapabilityProfile = {
  id: "default_caps_v1",
  capabilities: {
    ads:      60,
    tracking: 60,
    funnel:   55,
    content:  55,
    website:  30,
    seo:      30,
    crm:      25,
  } satisfies Record<Capability, number>,
};