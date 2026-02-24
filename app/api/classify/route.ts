// app/api/classify/route.ts
import { NextResponse } from "next/server";
import { persistClassification, getRawCompanyById } from "@/lib/persistence";
import { classifyCompany } from "@/lib/classification";
import { scoreLead } from "@/lib/scoring";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const rawId = body?.rawId;

  if (rawId === null || rawId === undefined || rawId === "") {
    return NextResponse.json({ error: "rawId required" }, { status: 400 });
  }

  const rawIdNum = Number(rawId);
  if (!Number.isFinite(rawIdNum)) {
    return NextResponse.json(
      { error: "rawId must be a number" },
      { status: 400 },
    );
  }

  const raw = await getRawCompanyById(rawIdNum);
  if (!raw) {
    return NextResponse.json(
      { error: "Raw company not found" },
      { status: 404 },
    );
  }

  const classification = classifyCompany(raw);

  await persistClassification(rawIdNum, classification);

  // scoreLead expects (raw, classification). ScoreResult has no `priority`.
  const scoreResult = scoreLead(raw, classification);

  return NextResponse.json({
    rawId: rawIdNum,
    classification,
    score: scoreResult,
  });
}
