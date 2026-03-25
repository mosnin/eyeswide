import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreatorDashboard } from "@/components/dashboard/creator-dashboard";
import { BrandDashboard } from "@/components/dashboard/brand-dashboard";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  if (profile.account_type === "admin") {
    redirect("/admin");
  }

  if (profile.account_type === "creator") {
    const { data: creatorProfile } = await supabase
      .from("creator_profiles")
      .select("*, social_accounts(*)")
      .eq("user_id", user.id)
      .single();

    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("*, brand_profiles(company_name, logo_url)")
      .eq("creator_id", creatorProfile?.id || "")
      .order("created_at", { ascending: false })
      .limit(5);

    return (
      <CreatorDashboard
        profile={profile}
        creatorProfile={creatorProfile}
        recentCampaigns={campaigns || []}
      />
    );
  }

  if (profile.account_type === "brand") {
    const { data: brandProfile } = await supabase
      .from("brand_profiles")
      .select("*, subscriptions(*)")
      .eq("user_id", user.id)
      .single();

    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("*, creator_profiles(display_name, avatar_url)")
      .eq("brand_id", brandProfile?.id || "")
      .order("created_at", { ascending: false })
      .limit(5);

    const { count: totalCreators } = await supabase
      .from("creator_profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_available", true);

    return (
      <BrandDashboard
        profile={profile}
        brandProfile={brandProfile}
        recentCampaigns={campaigns || []}
        totalCreators={totalCreators || 0}
      />
    );
  }

  redirect("/login");
}
