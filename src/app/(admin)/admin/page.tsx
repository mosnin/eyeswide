import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export default async function AdminPage() {
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

  if (!profile || profile.account_type !== "admin") {
    redirect("/dashboard");
  }

  // Get stats
  const { count: totalUsers } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });

  const { count: totalCreators } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("account_type", "creator");

  const { count: totalBrands } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("account_type", "brand");

  const { count: totalCampaigns } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true });

  const { count: activeCampaigns } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "accepted", "in_progress"]);

  const { count: activeSubscriptions } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .in("status", ["active", "trialing"]);

  // Recent users
  const { data: recentUsers } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  // Recent campaigns
  const { data: recentCampaigns } = await supabase
    .from("campaigns")
    .select("*, brand_profiles(company_name), creator_profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <AdminDashboard
      stats={{
        totalUsers: totalUsers || 0,
        totalCreators: totalCreators || 0,
        totalBrands: totalBrands || 0,
        totalCampaigns: totalCampaigns || 0,
        activeCampaigns: activeCampaigns || 0,
        activeSubscriptions: activeSubscriptions || 0,
      }}
      recentUsers={recentUsers || []}
      recentCampaigns={recentCampaigns || []}
    />
  );
}
