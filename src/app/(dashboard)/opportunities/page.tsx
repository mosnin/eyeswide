import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OpportunitiesFeed } from "@/components/dashboard/opportunities-feed";

export default async function OpportunitiesPage() {
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

  // Get active opportunities with brand info
  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("*, brand_profiles(company_name, logo_url, industry)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  // Get creator profile if creator
  let creatorId: string | null = null;
  let appliedOpportunityIds: string[] = [];

  if (profile.account_type === "creator") {
    const { data: creatorProfile } = await supabase
      .from("creator_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    creatorId = creatorProfile?.id || null;

    if (creatorId) {
      const { data: applications } = await supabase
        .from("opportunity_applications")
        .select("opportunity_id")
        .eq("creator_id", creatorId);

      appliedOpportunityIds =
        (applications || []).map((a) => a.opportunity_id) || [];
    }
  }

  // Get brand profile if brand
  let brandId: string | null = null;
  if (profile.account_type === "brand") {
    const { data: brandProfile } = await supabase
      .from("brand_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    brandId = brandProfile?.id || null;
  }

  return (
    <OpportunitiesFeed
      opportunities={opportunities || []}
      accountType={profile.account_type}
      creatorId={creatorId}
      brandId={brandId}
      appliedOpportunityIds={appliedOpportunityIds}
    />
  );
}
