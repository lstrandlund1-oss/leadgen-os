// app/api/stripe/checkout/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getServiceClient } from "@/lib/supabaseServiceClient";
import { getStripeClient, getStripePriceId } from "@/lib/stripeClient";

const VALID_PLANS = ["scout", "operator", "agency"];
const VALID_PERIODS = ["monthly", "quarterly", "yearly"];
const VALID_CURRENCIES = ["eur", "usd", "sek", "gbp"];

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let body: { plan?: string; period?: string; currency?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { plan, period, currency } = body;
    if (
      !plan ||
      !period ||
      !currency ||
      !VALID_PLANS.includes(plan) ||
      !VALID_PERIODS.includes(period) ||
      !VALID_CURRENCIES.includes(currency)
    ) {
      return NextResponse.json({ error: "Invalid plan, period, or currency" }, { status: 400 });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return NextResponse.json({ error: "Payments are not configured" }, { status: 500 });
    }

    const priceId = getStripePriceId(plan, period, currency);
    if (!priceId) {
      return NextResponse.json(
        { error: "No price configured for this plan/period/currency combination" },
        { status: 500 },
      );
    }

    // Reuse an existing Stripe customer if this user already has one (e.g.
    // from a previous, canceled subscription) rather than creating a
    // duplicate customer record every time they check out.
    const serviceClient = await getServiceClient();
    let existingCustomerId: string | undefined;
    if (serviceClient) {
      const { data } = await serviceClient
        .from("user_subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", authUser.id)
        .maybeSingle();
      existingCustomerId = data?.stripe_customer_id;
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.vantioapp.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      ...(existingCustomerId ? { customer: existingCustomerId } : { customer_email: authUser.email }),
      success_url: `${baseUrl}/dashboard?checkout=success`,
      cancel_url: `${baseUrl}/plans?checkout=canceled`,
      client_reference_id: authUser.id,
      metadata: { userId: authUser.id, plan, period, currency },
      subscription_data: {
        metadata: { userId: authUser.id, plan, period, currency },
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("/api/stripe/checkout error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
