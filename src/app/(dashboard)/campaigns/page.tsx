import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CampaignsList } from "@/components/dashboard/campaigns-list";

export default async function CampaignsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  let campaigns: Record<string, unknown>[] = [];

  if (profile.account_type === "creator") {
    const { data: creatorProfile } = await supabase
      .from("creator_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (creatorProfile) {
      const { data } = await supabase
        .from("campaigns")
        .select("*, brand_profiles(company_name, logo_url)")
        .eq("creator_id", creatorProfile.id)
        .order("created_at", { ascending: false });
      campaigns = data || [];
    }
  } else if (profile.account_type === "brand") {
    const { data: brandProfile } = await supabase
      .from("brand_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (brandProfile) {
      const { data } = await supabase
        .from("campaigns")
        .select("*, creator_profiles(display_name, avatar_url)")
        .eq("brand_id", brandProfile.id)
        .order("created_at", { ascending: false });
      campaigns = data || [];
    }
  }

  return (
    <CampaignsList
      campaigns={campaigns}
      accountType={profile.account_type}
    />
  );
}
