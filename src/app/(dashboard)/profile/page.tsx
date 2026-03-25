import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CreatorProfilePage } from "@/components/dashboard/creator-profile-page";

export default async function ProfilePage() {
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

  if (!profile || profile.account_type !== "creator") {
    redirect("/dashboard");
  }

  const { data: creatorProfile } = await supabase
    .from("creator_profiles")
    .select("*, social_accounts(*)")
    .eq("user_id", user.id)
    .single();

  if (!creatorProfile) redirect("/dashboard");

  return <CreatorProfilePage creatorProfile={creatorProfile} />;
}
