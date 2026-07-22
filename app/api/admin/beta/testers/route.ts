// app/api/admin/beta/testers/route.ts
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/beta/adminAuth";
import { getAllTesterOverviews } from "@/lib/beta/adminOverview";
import { getAllInvitations } from "@/lib/beta/invitations";

export async function GET() {
  const { isAdmin } = await isAdminRequest();
  if (!isAdmin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const [testers, invitations] = await Promise.all([getAllTesterOverviews(), getAllInvitations()]);
  return NextResponse.json({ testers, invitations });
}
