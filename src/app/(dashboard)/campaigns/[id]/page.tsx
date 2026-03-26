import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { CampaignDetail } from "@/components/dashboard/campaign-detail";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data: campaign } = await supabase
    .from("campaigns")
    .select(
      "*, brand_profiles(id, company_name, logo_url, user_id), creator_profiles(id, display_name, avatar_url, user_id)"
    )
    .eq("id", id)
    .single();

  if (!campaign) notFound();

  // Get messages for this campaign
  const { data: messages } = await supabase
    .from("messages")
    .select("*, profiles(full_name, avatar_url)")
    .eq("campaign_id", id)
    .order("created_at", { ascending: true });

  return (
    <CampaignDetail
      campaign={campaign}
      messages={messages || []}
      userId={user.id}
      accountType={profile.account_type}
    />
  );
}
