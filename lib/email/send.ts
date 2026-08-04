// lib/email/send.ts
// Shared Resend email helper.
// Domain vantioapp.com verified in Resend on 2026-03-12.

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// ── Swap this when domain is verified ────────────────────────────────────────
const FROM_ADDRESS = "Vantio <hello@vantioapp.com>";
const SUPPORT_INBOX = process.env.SUPPORT_NOTIFY_EMAIL ?? "lstrandlund1@gmail.com";
const APP_NAME = "Vantio";

// ── Base styles ───────────────────────────────────────────────────────────────
const baseHtml = (body: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { background: #080808; color: #c8c0b0; font-family: 'DM Sans', Arial, sans-serif; margin: 0; padding: 0; }
    .wrap { max-width: 560px; margin: 40px auto; padding: 0 24px; }
    .card { background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 16px; padding: 32px; }
    .logo { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #c9a84c; margin-bottom: 24px; }
    h1 { font-size: 22px; font-weight: 300; color: #f5f0e8; margin: 0 0 12px; }
    p { font-size: 14px; line-height: 1.6; color: #888; margin: 0 0 16px; }
    .btn { display: inline-block; padding: 12px 24px; background: rgba(201,168,76,0.1); border: 1px solid rgba(201,168,76,0.3); border-radius: 10px; color: #c9a84c; text-decoration: none; font-size: 13px; font-weight: 500; margin: 8px 0 16px; }
    .divider { border: none; border-top: 1px solid #1a1a1a; margin: 24px 0; }
    .footer { font-size: 11px; color: #333; text-align: center; margin-top: 24px; }
    .tag { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
    .tag-red { background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.2); color: #f87171; }
    .tag-green { background: rgba(74,222,128,0.1); border: 1px solid rgba(74,222,128,0.2); color: #4ade80; }
    pre { background: #111; border: 1px solid #252525; border-radius: 8px; padding: 16px; font-size: 12px; color: #888; white-space: pre-wrap; overflow-wrap: break-word; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="logo">◈ ${APP_NAME}</div>
    <div class="card">${body}</div>
    <p class="footer">${APP_NAME} · You're receiving this because you signed up or contacted support.</p>
  </div>
</body>
</html>
`;

// ── Types ─────────────────────────────────────────────────────────────────────
export type EmailResult = { ok: true } | { ok: false; error: string };

// ── Generic send ──────────────────────────────────────────────────────────────
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<EmailResult> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping send");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (error) {
      console.error("[email] Resend error:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[email] send failed:", msg);
    return { ok: false, error: msg };
  }
}

// ── Template: Waitlist confirmation ───────────────────────────────────────────
export async function sendWaitlistConfirmation(opts: { to: string; plan: string }): Promise<EmailResult> {
  const planLabel = opts.plan === "operator" ? "Operator" : opts.plan === "agency" ? "Agency" : "Scout";
  return sendEmail({
    to: opts.to,
    subject: `You're on the ${APP_NAME} waitlist`,
    html: baseHtml(`
      <h1>You're on the list.</h1>
      <p>Thanks for signing up — you've been added to the <strong style="color:#c9a84c">${planLabel}</strong> waitlist. We'll reach out as soon as your spot is ready.</p>
      <p>In the meantime, if you have any questions just reply to this email.</p>
      <hr class="divider" />
      <p style="font-size:12px;color:#444;">Plan selected: ${planLabel}</p>
    `),
    text: `You're on the ${APP_NAME} waitlist.\n\nPlan: ${planLabel}\n\nWe'll reach out when your spot is ready.`,
  });
}

// ── Template: Support ticket — notify owner ───────────────────────────────────
export async function sendSupportTicketNotification(opts: {
  userEmail: string | null;
  userPlan: string | null;
  businessName: string | null;
  status: string;
  summary: string;
  transcript: string;
}): Promise<EmailResult> {
  const isHuman = opts.status === "needs_human";
  const tagHtml = isHuman
    ? `<span class="tag tag-red">🔴 Needs review</span>`
    : `<span class="tag tag-green">✅ Resolved</span>`;

  return sendEmail({
    to: SUPPORT_INBOX,
    subject: `[Support] ${isHuman ? "🔴 Needs Review" : "✅ Resolved"} — ${opts.userEmail ?? "Anonymous"}`,
    html: baseHtml(`
      <h1>New support ticket</h1>
      <p>${tagHtml}</p>
      <p>
        <strong style="color:#c8c0b0">User:</strong> ${opts.userEmail ?? "Anonymous"}<br/>
        <strong style="color:#c8c0b0">Plan:</strong> ${opts.userPlan ?? "unknown"}<br/>
        <strong style="color:#c8c0b0">Business:</strong> ${opts.businessName ?? "unknown"}
      </p>
      <hr class="divider" />
      <p style="font-size:12px;color:#555;margin-bottom:8px;">SUMMARY</p>
      <p>${opts.summary}</p>
      <hr class="divider" />
      <p style="font-size:12px;color:#555;margin-bottom:8px;">TRANSCRIPT</p>
      <pre>${opts.transcript}</pre>
    `),
    text: `Support ticket — ${opts.status}\nUser: ${opts.userEmail ?? "anon"}\nPlan: ${opts.userPlan ?? "?"}\nBusiness: ${opts.businessName ?? "?"}\n\nSummary:\n${opts.summary}\n\nTranscript:\n${opts.transcript}`,
  });
}

// ── Template: Support ticket — confirmation to user ───────────────────────────
export async function sendSupportTicketConfirmation(opts: {
  to: string;
  summary: string;
  resolved: boolean;
}): Promise<EmailResult> {
  return sendEmail({
    to: opts.to,
    subject: opts.resolved
      ? `Your ${APP_NAME} question was answered`
      : `We've received your ${APP_NAME} support request`,
    html: baseHtml(
      opts.resolved
        ? `
          <h1>Question answered.</h1>
          <p>Your support chat was resolved automatically. Here's what you asked about:</p>
          <p style="color:#c8c0b0;font-style:italic;">"${opts.summary}"</p>
          <p>If you need anything else, open the chat widget anytime or reply to this email.</p>
        `
        : `
          <h1>We've got your message.</h1>
          <p>Your request has been passed to a human. Here's what you reported:</p>
          <p style="color:#c8c0b0;font-style:italic;">"${opts.summary}"</p>
          <p>We'll get back to you as soon as possible.</p>
        `,
    ),
    text: opts.resolved
      ? `Your question was answered.\n\nYou asked: "${opts.summary}"\n\nIf you need more help, open the chat widget anytime.`
      : `We've received your support request.\n\nYou reported: "${opts.summary}"\n\nA human will follow up shortly.`,
  });
}
// ── Template: Workspace invite ─────────────────────────────────────────────

export async function sendWorkspaceInvite(opts: {
  to: string;
  workspaceName: string;
  invitedByEmail: string;
  acceptUrl: string;
}): Promise<EmailResult> {
  return sendEmail({
    to: opts.to,
    subject: `${opts.invitedByEmail} invited you to join ${opts.workspaceName} on Vantio`,
    html: baseHtml(`
      <h1>You've been invited.</h1>
      <p><strong style="color:#c8c0b0">${opts.invitedByEmail}</strong> has invited you to join <strong style="color:#c9a84c">${opts.workspaceName}</strong> on Vantio.</p>
      <a href="${opts.acceptUrl}" class="btn">Accept invitation →</a>
      <hr class="divider" />
      <p style="font-size:12px;color:#444;">If you don't have a Vantio account yet, you'll be able to create one before joining.</p>
    `),
    text: `${opts.invitedByEmail} has invited you to join ${opts.workspaceName} on Vantio.\n\nAccept: ${opts.acceptUrl}`,
  });
}

export async function sendOnboardingDay1(opts: {
  to: string;
  firstName?: string;
  name?: string;
}): Promise<EmailResult> {
  const name = opts.name ?? opts.firstName ?? "there";
  return sendEmail({
    to: opts.to,
    subject: `Welcome to Vantio — your first search awaits`,
    html: baseHtml(`
      <h1>Welcome to Vantio, ${name}.</h1>
      <p>You're in. Here's how to get your first scored lead in under 2 minutes:</p>
      <p><strong style="color:#c8c0b0">1.</strong> Go to your dashboard and enter a niche — e.g. <em>restaurang</em>, <em>tandläkare</em>, or <em>fastighetsmäklare</em></p>
      <p><strong style="color:#c8c0b0">2.</strong> Add a city — Stockholm, Göteborg, Malmö, wherever you work</p>
      <p><strong style="color:#c8c0b0">3.</strong> Hit Generate Leads</p>
      <p>Every result gets an Opportunity score, a Risk score, and a gap type — so you know exactly who to reach out to first.</p>
      <a href="${process.env.NEXT_PUBLIC_BASE_URL ?? "https://vantioapp.com"}/dashboard" class="btn">Find my first leads →</a>
      <hr class="divider"/>
      <p style="font-size:12px;color:#444;">You're on beta access — full platform, no limits, no card required.</p>
    `),
    text: `Welcome to Vantio!\n\nYour first search takes under 2 minutes:\n1. Enter a niche (e.g. restaurang, tandläkare)\n2. Add a city\n3. Hit Generate Leads\n\nEvery result gets scored so you know who to contact first.\n\n${process.env.NEXT_PUBLIC_BASE_URL ?? "https://vantioapp.com"}/dashboard`,
  });
}

export async function sendOnboardingDay3(opts: { to: string }): Promise<EmailResult> {
  return sendEmail({
    to: opts.to,
    subject: `How to read a Vantio lead score`,
    html: baseHtml(`
      <h1>Three numbers that change how you prospect.</h1>
      <p>Every lead in Vantio gets three scores:</p>
      <p><strong style="color:#c9a84c">Opportunity (0–100)</strong> — How much untapped potential exists. High = clear gap between where they are and where they could be.</p>
      <p><strong style="color:#f87171">Risk (0–100)</strong> — Signals of instability or strong competition. Low risk = safer bet. High risk doesn't mean skip — it means price accordingly.</p>
      <p><strong style="color:#4ade80">Fit (0–100)</strong> — How well this lead's needs match your specific services. This is personalised to your profile — no two users see the same fit score for the same lead.</p>
      <p>The sweet spot: <strong style="color:#c8c0b0">high opportunity + low risk + high fit</strong>. That's your best first call.</p>
      <a href="${process.env.NEXT_PUBLIC_BASE_URL ?? "https://vantioapp.com"}/dashboard" class="btn">Review my leads →</a>
    `),
    text: `How to read a Vantio lead score:\n\nOpportunity — untapped potential\nRisk — instability signals\nFit — match to your specific services\n\nBest leads: high opportunity + low risk + high fit.\n\n${process.env.NEXT_PUBLIC_BASE_URL ?? "https://vantioapp.com"}/dashboard`,
  });
}

export async function sendOnboardingDay7(opts: { to: string }): Promise<EmailResult> {
  return sendEmail({
    to: opts.to,
    subject: `You've been on Vantio for a week — here's what to do next`,
    html: baseHtml(`
      <h1>One week in.</h1>
      <p>If you've run your first search — great. If not, now's the time.</p>
      <p>The single biggest thing you can do this week to get value from Vantio: <strong style="color:#c8c0b0">open a lead, read the gap type, and send one outreach message.</strong></p>
      <p>Every lead has a gap type — Visibility, Conversion, Infrastructure, or Optimization. This tells you exactly what angle to lead with. You don't need to figure it out yourself.</p>
      <p>On Operator plan, the outreach generator writes the message for you based on those signals. On Scout, you get the angle and script structure to write it yourself.</p>
      <a href="${process.env.NEXT_PUBLIC_BASE_URL ?? "https://vantioapp.com"}/outreach" class="btn">Generate my first outreach →</a>
      <hr class="divider"/>
      <p style="font-size:12px;color:#444;">Questions? Just reply to this email — we read everything.</p>
    `),
    text: `One week on Vantio.\n\nThe best thing you can do: open a lead, read the gap type, send one outreach.\n\nEvery lead has a gap type (Visibility, Conversion, Infrastructure, Optimization) — it tells you exactly what angle to use.\n\n${process.env.NEXT_PUBLIC_BASE_URL ?? "https://vantioapp.com"}/outreach`,
  });
}
