import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import type { AccountType } from "@/types/database";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, account_type, onboarding_status")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  // Redirect to onboarding if not completed
  if (profile.onboarding_status !== "completed") {
    const onboardingPath =
      profile.account_type === "brand"
        ? "/onboarding/brand"
        : "/onboarding/creator";
    redirect(onboardingPath);
  }

  // Redirect admin users to admin dashboard
  if (profile.account_type === "admin") {
    // Allow admin to access /settings but redirect /dashboard to /admin
    // This is handled by the page itself
  }

  return (
    <div className="flex h-screen">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          accountType={profile.account_type as AccountType}
          userName={profile.full_name || user.email || "User"}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  );
}
