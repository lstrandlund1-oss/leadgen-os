// app/api/profile/route.ts
// GET  /api/profile  → returns saved profile or default
// POST /api/profile  → saves profile

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import type { UserProfileV1, CapabilityProfile } from "@/lib/types";
import type { Capability } from "@/lib/fit/needs";
import {
  buildUserProfile,
  buildCapabilityProfile,
  isValidProfileTypeKey,
} from "@/lib/profile/profileTypes";

const PROFILE_ID = "user_v1"; // single-user beta — one profile row

type ProfileRow = {
  id: string;
  profile_data: unknown;
  capabilities_data: unknown;
  updated_at: string;
};

function defaultProfile(): { profile: UserProfileV1; capabilities: CapabilityProfile } {
  return {
    profile: buildUserProfile(PROFILE_ID, "performance_marketer"),
    capabilities: buildCapabilityProfile(PROFILE_ID, "performance_marketer"),
  };
}

export async function GET() {
  try {
    if (!supabase) {
      const d = defaultProfile();
      return NextResponse.json({ profile: d.profile, capabilities: d.capabilities });
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, profile_data, capabilities_data, updated_at")
      .eq("id", PROFILE_ID)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      const d = defaultProfile();
      return NextResponse.json({ profile: d.profile, capabilities: d.capabilities });
    }

    const row = data as ProfileRow;
    const profile = row.profile_data as UserProfileV1;
    const capabilities = row.capabilities_data as CapabilityProfile;

    return NextResponse.json({ profile, capabilities });
  } catch (err) {
    console.error("/api/profile GET error:", err);
    const d = defaultProfile();
    return NextResponse.json({ profile: d.profile, capabilities: d.capabilities });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      profileType,
      businessName,
      experienceLevel,
      targetBusinessSize,
      acquisitionStyle,
      budgetPreference,
      capabilities: capOverrides,
    }: {
      profileType?: string;
      businessName?: string;
      experienceLevel?: UserProfileV1["experienceLevel"];
      targetBusinessSize?: UserProfileV1["targetBusinessSize"];
      acquisitionStyle?: UserProfileV1["acquisitionStyle"];
      budgetPreference?: UserProfileV1["budgetPreference"];
      capabilities?: Partial<Record<Capability, boolean>>;
    } = body;

    // Build from type defaults then apply overrides
    const validKey = isValidProfileTypeKey(profileType ?? "") ? profileType! : "performance_marketer";
    const profile = buildUserProfile(PROFILE_ID, validKey as Parameters<typeof buildUserProfile>[1], {
      ...(businessName ? { businessName } : {}),
      ...(experienceLevel ? { experienceLevel } : {}),
      ...(targetBusinessSize ? { targetBusinessSize } : {}),
      ...(acquisitionStyle ? { acquisitionStyle } : {}),
      ...(budgetPreference ? { budgetPreference } : {}),
      profileType: validKey,
    });

    const capabilities = buildCapabilityProfile(
      PROFILE_ID,
      validKey as Parameters<typeof buildCapabilityProfile>[1],
      capOverrides,
    );

    if (!supabase) {
      return NextResponse.json({ profile, capabilities });
    }

    const { error } = await supabase
      .from("user_profiles")
      .upsert({
        id: PROFILE_ID,
        profile_data: profile,
        capabilities_data: capabilities,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    return NextResponse.json({ profile, capabilities });
  } catch (err) {
    console.error("/api/profile POST error:", err);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}