// lib/email/send.ts
// Shared Resend email helper.
// FROM address uses onboarding@resend.dev until a verified domain is set up.
// Swap FROM_ADDRESS to "support@vantio.com" once domain is verified in Resend.

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// ── Swap this when domain is verified ────────────────────────────────────────
const FROM_ADDRESS = "Vantio <onboarding@resend.dev>";
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
export async function sendWaitlistConfirmation(opts: {
  to: string;
  plan: string;
}): Promise<EmailResult> {
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
        `
    ),
    text: opts.resolved
      ? `Your question was answered.\n\nYou asked: "${opts.summary}"\n\nIf you need more help, open the chat widget anytime.`
      : `We've received your support request.\n\nYou reported: "${opts.summary}"\n\nA human will follow up shortly.`,
  });
}