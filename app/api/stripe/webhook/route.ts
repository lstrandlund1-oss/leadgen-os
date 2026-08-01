// app/api/stripe/webhook/route.ts
//
// Verifies the Stripe signature on every request (never trust an
// unverified webhook body) and records subscription state in
// user_subscriptions. Deliberately does NOT touch lib/plan.ts's
// getEffectivePlan() — that rewiring is a separate, deferred task (see
// migration 0013's comment for why).

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripeClient";
import { getServiceClient } from "@/lib/supabaseServiceClient";

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Raw body required for signature verification — must not be JSON-parsed
  // before this point.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const serviceClient = await getServiceClient();
  if (!serviceClient) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId ?? session.client_reference_id;
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (!userId || !subscriptionId || !session.customer) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertSubscription(serviceClient, {
          userId,
          plan: session.metadata?.plan ?? "operator",
          period: session.metadata?.period ?? "monthly",
          currency: session.metadata?.currency ?? "eur",
          status: subscription.status,
          stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer.id,
          stripeSubscriptionId: subscriptionId,
          currentPeriodEnd: subscription.items.data[0]?.current_period_end ?? null,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        if (!userId) break;

        await upsertSubscription(serviceClient, {
          userId,
          plan: subscription.metadata?.plan ?? "operator",
          period: subscription.metadata?.period ?? "monthly",
          currency: subscription.metadata?.currency ?? "eur",
          status: event.type === "customer.subscription.deleted" ? "canceled" : subscription.status,
          stripeCustomerId:
            typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
          stripeSubscriptionId: subscription.id,
          currentPeriodEnd: subscription.items.data[0]?.current_period_end ?? null,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });
        break;
      }

      default:
        // Other event types are intentionally ignored for now.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook handling error:", err);
    // Return 500 so Stripe retries — losing a subscription-state update
    // silently is worse than a duplicate retry.
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function upsertSubscription(
  client: NonNullable<Awaited<ReturnType<typeof getServiceClient>>>,
  params: {
    userId: string;
    plan: string;
    period: string;
    currency: string;
    status: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    currentPeriodEnd: number | null;
    cancelAtPeriodEnd: boolean;
  },
): Promise<void> {
  const { error } = await client.from("user_subscriptions").upsert(
    {
      user_id: params.userId,
      plan: params.plan,
      period: params.period,
      currency: params.currency,
      status: params.status,
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.stripeSubscriptionId,
      current_period_end: params.currentPeriodEnd ? new Date(params.currentPeriodEnd * 1000).toISOString() : null,
      cancel_at_period_end: params.cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("user_subscriptions upsert error:", error.message);
    throw error;
  }
}
