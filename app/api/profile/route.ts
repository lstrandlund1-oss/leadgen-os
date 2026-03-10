// app/api/profile/route.ts
import { NextResponse } from "next/server";
import { getAuthUser, createSupabaseServer } from "@/lib/supabaseServer";
import { supabase } from "@/lib/supabaseClient";
import type { UserProfileV1, CapabilityProfile } from "@/lib/types";
import type { Capability } from "@/lib/fit/needs";
import {
  buildUserProfile,
  buildCapabilityProfile,
  isValidProfileTypeKey,
} from "@/lib/profile/profileTypes";

const FALLBACK_ID = "user_v1";

type ProfileRow = {
  id: string;
  profile_data: unknown;
  capabilities_data: unknown;
  updated_at: string;
};

function defaultProfile(id: string) {
  return {
    profile: buildUserProfile(id, "performance_marketer"),
    capabilities: buildCapabilityProfile(id, "performance_marketer"),
  };
}

export async function GET() {
  try {
    const user = await getAuthUser();
    const profileId = user?.id ?? FALLBACK_ID;

    if (!supabase) {
      const d = defaultProfile(profileId);
      return NextResponse.json({ profile: d.profile, capabilities: d.capabilities });
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, profile_data, capabilities_data, updated_at")
      .eq("id", profileId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      const d = defaultProfile(profileId);
      return NextResponse.json({ profile: d.profile, capabilities: d.capabilities });
    }

    const row = data as ProfileRow;
    return NextResponse.json({
      profile: row.profile_data as UserProfileV1,
      capabilities: row.capabilities_data as CapabilityProfile,
    });
  } catch (err) {
    console.error("/api/profile GET error:", err);
    const d = defaultProfile(FALLBACK_ID);
    return NextResponse.json({ profile: d.profile, capabilities: d.capabilities });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    const profileId = user?.id ?? FALLBACK_ID;

    const body = await request.json();
    const {
      profileType,
      businessName,
      experienceLevel,
      targetBusinessSize,
      acquisitionStyle,
      budgetPreference,
      targetLocation,
      capabilities: capOverrides,
    }: {
      profileType?: string;
      businessName?: string;
      experienceLevel?: UserProfileV1["experienceLevel"];
      targetBusinessSize?: UserProfileV1["targetBusinessSize"];
      acquisitionStyle?: UserProfileV1["acquisitionStyle"];
      budgetPreference?: UserProfileV1["budgetPreference"];
      targetLocation?: string;
      capabilities?: Partial<Record<Capability, boolean>>;
    } = body;

    const validKey = isValidProfileTypeKey(profileType ?? "")
      ? (profileType as Parameters<typeof buildUserProfile>[1])
      : "performance_marketer";

    const profile = buildUserProfile(profileId, validKey, {
      ...(businessName ? { businessName } : {}),
      ...(experienceLevel ? { experienceLevel } : {}),
      ...(targetBusinessSize ? { targetBusinessSize } : {}),
      ...(acquisitionStyle ? { acquisitionStyle } : {}),
      ...(budgetPreference ? { budgetPreference } : {}),
      ...(targetLocation !== undefined ? { targetLocation } : {}),
      profileType: validKey,
    });

    const capabilities = buildCapabilityProfile(profileId, validKey, capOverrides);

    if (!supabase) {
      return NextResponse.json({ profile, capabilities });
    }

    // Use authenticated server client so RLS policies are satisfied
    const authedSupabase = await createSupabaseServer();
    const { error } = await authedSupabase.from("user_profiles").upsert({
      id: profileId,
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