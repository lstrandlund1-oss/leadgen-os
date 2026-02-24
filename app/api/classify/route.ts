import { NextResponse } from "next/server";
import { persistClassification, getRawCompanyById } from "@/lib/persistence";
import { classifyCompany } from "@/lib/classification";
import { scoreLead } from "@/lib/scoring";

export async function POST(req: Request) {
  const { rawId } = await req.json();

  if (!rawId) {
    return NextResponse.json({ error: "rawId required" }, { status: 400 });
  }

  const raw = await getRawCompanyById(Number(rawId));
  if (!raw) {
    return NextResponse.json({ error: "Raw company not found" }, { status: 404 });
  }

  const classification = classifyCompany(raw);

  await persistClassification(rawId, classification);

  const { score, priority } = scoreLead(raw, classification);

  return NextResponse.json({
    rawId,
    classification,
    score,
    priority,
  });
}

