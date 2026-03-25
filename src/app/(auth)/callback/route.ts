import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Get user profile to check onboarding status
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("account_type, onboarding_status")
          .eq("id", user.id)
          .single();

        // Password recovery - redirect to settings
        if (type === "recovery") {
          return NextResponse.redirect(`${origin}/settings`);
        }

        // If onboarding not completed, redirect to onboarding
        if (profile && profile.onboarding_status !== "completed") {
          const onboardingPath =
            profile.account_type === "brand"
              ? "/onboarding/brand"
              : "/onboarding/creator";
          return NextResponse.redirect(`${origin}${onboardingPath}`);
        }
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  // Auth error - redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
