import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CreatorDirectory } from "@/components/dashboard/creator-directory";

export default async function CreatorsPage() {
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

  if (!profile || profile.account_type !== "brand") {
    redirect("/dashboard");
  }

  const { data: brandProfile } = await supabase
    .from("brand_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const { data: creators } = await supabase
    .from("creator_profiles")
    .select("*, social_accounts(*)")
    .eq("is_available", true)
    .order("created_at", { ascending: false });

  return (
    <CreatorDirectory
      creators={creators || []}
      brandId={brandProfile?.id || ""}
    />
  );
}
