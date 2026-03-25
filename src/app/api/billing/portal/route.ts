import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: brandProfile } = await supabase
      .from("brand_profiles")
      .select("id, subscriptions(ls_customer_id)")
      .eq("user_id", user.id)
      .single();

    const subscriptions = brandProfile?.subscriptions as unknown as Record<string, unknown>[] | null;
    const subscription = subscriptions?.[0] ?? null;
    const customerId = subscription?.ls_customer_id as string | null;

    if (!customerId) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    // Get customer portal URL from Lemon Squeezy
    const response = await fetch(
      `https://api.lemonsqueezy.com/v1/customers/${customerId}`,
      {
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to get portal URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: data.data.attributes.urls.customer_portal,
    });
  } catch (error) {
    console.error("Portal error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
