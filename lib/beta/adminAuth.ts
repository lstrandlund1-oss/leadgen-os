// lib/beta/adminAuth.ts
// Minimal admin authorization for the private beta system: a server-side
// email allowlist. No existing admin authorization pattern was found in
// the codebase, and the spec explicitly says not to build a large generic
// admin platform for a program run by one operator managing 3-5 testers —
// an allowlist is deliberately sufficient here, not a placeholder for a
// future role system.
//
// Configure via the ADMIN_EMAILS env var: a comma-separated list of emails.
// Never expose this as NEXT_PUBLIC_ — it must only be readable server-side.

import { getAuthUser } from "@/lib/supabaseServer";

export async function isAdminRequest(): Promise<{ isAdmin: boolean; email: string | null }> {
  const user = await getAuthUser();
  if (!user?.email) return { isAdmin: false, email: null };

  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return { isAdmin: allowlist.includes(user.email.toLowerCase()), email: user.email };
}
