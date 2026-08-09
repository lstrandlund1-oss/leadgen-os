import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/beta/adminAuth";

export async function GET() {
  const { isAdmin } = await isAdminRequest();
  return NextResponse.json({ isAdmin });
}
