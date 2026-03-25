import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// Use service role key for webhook processing (bypasses RLS)
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!;
  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(payload).digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-signature") || "";

    // Verify webhook signature
    if (!verifyWebhookSignature(body, signature)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const event = JSON.parse(body);
    const eventName = event.meta.event_name;
    const customData = event.meta.custom_data;
    const userId = customData?.user_id;

    const supabase = getAdminClient();

    switch (eventName) {
      case "subscription_created": {
        const attrs = event.data.attributes;

        // Get brand profile for this user
        const { data: brandProfile } = await supabase
          .from("brand_profiles")
          .select("id")
          .eq("user_id", userId)
          .single();

        if (brandProfile) {
          await supabase.from("subscriptions").upsert({
            brand_id: brandProfile.id,
            ls_customer_id: String(attrs.customer_id),
            ls_subscription_id: String(event.data.id),
            plan: "pro",
            status: attrs.status === "on_trial" ? "trialing" : "active",
            current_period_start: attrs.renews_at
              ? new Date(attrs.created_at).toISOString()
              : null,
            current_period_end: attrs.renews_at
              ? new Date(attrs.renews_at).toISOString()
              : null,
            trial_ends_at: attrs.trial_ends_at
              ? new Date(attrs.trial_ends_at).toISOString()
              : null,
          }, {
            onConflict: "brand_id",
          });
        }
        break;
      }

      case "subscription_updated": {
        const attrs = event.data.attributes;
        const subscriptionId = String(event.data.id);

        let status = "active";
        if (attrs.status === "on_trial") status = "trialing";
        else if (attrs.status === "past_due") status = "past_due";
        else if (attrs.status === "cancelled") status = "cancelled";
        else if (attrs.status === "paused") status = "paused";
        else if (attrs.status === "expired") status = "expired";

        await supabase
          .from("subscriptions")
          .update({
            status,
            current_period_end: attrs.renews_at
              ? new Date(attrs.renews_at).toISOString()
              : null,
            cancel_at_period_end: attrs.cancelled,
          })
          .eq("ls_subscription_id", subscriptionId);

        break;
      }

      case "subscription_cancelled": {
        const subscriptionId = String(event.data.id);

        await supabase
          .from("subscriptions")
          .update({
            status: "cancelled",
            cancel_at_period_end: true,
          })
          .eq("ls_subscription_id", subscriptionId);

        break;
      }

      case "subscription_expired": {
        const subscriptionId = String(event.data.id);

        await supabase
          .from("subscriptions")
          .update({ status: "expired" })
          .eq("ls_subscription_id", subscriptionId);

        break;
      }

      default:
        console.log(`Unhandled event: ${eventName}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
