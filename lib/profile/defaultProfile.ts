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
    ads: true,
    tracking: true,
    funnel: true,
    content: true,
    website: false,
    seo: false,
    crm: false,
  } satisfies Record<Capability, boolean>,
};