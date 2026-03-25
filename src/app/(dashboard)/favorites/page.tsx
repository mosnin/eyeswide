import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FavoritesPage } from "@/components/dashboard/favorites-page";

export default async function Favorites() {
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

  // Get user's favorites
  const { data: favorites } = await supabase
    .from("favorites")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Resolve favorite targets
  const creatorIds = (favorites || [])
    .filter((f) => f.target_type === "creator")
    .map((f) => f.target_id);
  const brandIds = (favorites || [])
    .filter((f) => f.target_type === "brand")
    .map((f) => f.target_id);

  let favoriteCreators: Record<string, unknown>[] = [];
  let favoriteBrands: Record<string, unknown>[] = [];

  if (creatorIds.length > 0) {
    const { data } = await supabase
      .from("creator_profiles")
      .select("*, social_accounts(platform, username)")
      .in("id", creatorIds);
    favoriteCreators = data || [];
  }

  if (brandIds.length > 0) {
    const { data } = await supabase
      .from("brand_profiles")
      .select("*")
      .in("id", brandIds);
    favoriteBrands = data || [];
  }

  return (
    <FavoritesPage
      accountType={profile.account_type}
      favoriteCreators={favoriteCreators}
      favoriteBrands={favoriteBrands}
    />
  );
}
