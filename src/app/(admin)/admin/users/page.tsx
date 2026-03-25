import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminUsersPage } from "@/components/admin/admin-users-page";

export default async function AdminUsers() {
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

  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  return <AdminUsersPage users={users || []} />;
}
