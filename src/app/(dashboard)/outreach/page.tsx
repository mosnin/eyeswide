import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OutreachForm } from "@/components/dashboard/outreach-form";

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<{ creator?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", user.id)
    .single();

  if (!profile || profile.account_type !== "brand") {
    redirect("/dashboard");
  }

  const { data: brandProfile } = await supabase
    .from("brand_profiles")
    .select("id, company_name")
    .eq("user_id", user.id)
    .single();

  if (!brandProfile) redirect("/dashboard");

  // Get selected creator if provided
  let selectedCreator = null;
  if (params.creator) {
    const { data } = await supabase
      .from("creator_profiles")
      .select("id, display_name, niche, bio")
      .eq("id", params.creator)
      .single();
    selectedCreator = data;
  }

  // Get all available creators for dropdown
  const { data: creators } = await supabase
    .from("creator_profiles")
    .select("id, display_name, niche")
    .eq("is_available", true)
    .order("display_name");

  return (
    <OutreachForm
      brandId={brandProfile.id}
      brandName={brandProfile.company_name}
      creators={creators || []}
      selectedCreator={selectedCreator}
    />
  );
}
