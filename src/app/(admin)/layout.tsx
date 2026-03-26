import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";

export default async function AdminLayout({
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
    .select("full_name, account_type")
    .eq("id", user.id)
    .single();

  if (!profile || profile.account_type !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="flex h-screen">
      <div className="hidden lg:block">
        <Sidebar
          accountType="admin"
          userName={profile.full_name || user.email || "Admin"}
        />
      </div>
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  );
}
