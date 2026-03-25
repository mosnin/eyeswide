import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BillingPage } from "@/components/dashboard/billing-page";

export default async function Billing() {
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
    .select("*, subscriptions(*)")
    .eq("user_id", user.id)
    .single();

  return <BillingPage brandProfile={brandProfile} />;
}
