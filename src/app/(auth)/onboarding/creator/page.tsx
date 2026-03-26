"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  User,
  Share2,
  CheckCircle2,
  X,
  Plus,
} from "lucide-react";
import type { SocialPlatform } from "@/types/database";

const NICHES = [
  "Beauty",
  "Fashion",
  "Fitness",
  "Food",
  "Gaming",
  "Health",
  "Home Decor",
  "Lifestyle",
  "Music",
  "Parenting",
  "Pets",
  "Photography",
  "Sports",
  "Tech",
  "Travel",
  "Wellness",
];

const PLATFORMS: { value: SocialPlatform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "twitter", label: "X (Twitter)" },
  { value: "facebook", label: "Facebook" },
  { value: "pinterest", label: "Pinterest" },
  { value: "snapchat", label: "Snapchat" },
  { value: "linkedin", label: "LinkedIn" },
];

interface SocialEntry {
  platform: SocialPlatform;
  username: string;
}

const TOTAL_STEPS = 4;

export default function CreatorOnboardingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Step 1: Basic info
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");

  // Step 2: Niche selection
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);

  // Step 3: Social accounts
  const [socials, setSocials] = useState<SocialEntry[]>([
    { platform: "instagram", username: "" },
  ]);

  function toggleNiche(niche: string) {
    setSelectedNiches((prev) =>
      prev.includes(niche)
        ? prev.filter((n) => n !== niche)
        : prev.length < 5
          ? [...prev, niche]
          : prev
    );
  }

  function addSocial() {
    const usedPlatforms = socials.map((s) => s.platform);
    const nextPlatform = PLATFORMS.find(
      (p) => !usedPlatforms.includes(p.value)
    );
    if (nextPlatform) {
      setSocials([...socials, { platform: nextPlatform.value, username: "" }]);
    }
  }

  function removeSocial(index: number) {
    setSocials(socials.filter((_, i) => i !== index));
  }

  function updateSocial(
    index: number,
    field: keyof SocialEntry,
    value: string
  ) {
    const updated = [...socials];
    updated[index] = { ...updated[index], [field]: value };
    setSocials(updated);
  }

  function getPlatformUrl(platform: SocialPlatform, username: string): string {
    const urls: Record<SocialPlatform, string> = {
      instagram: `https://instagram.com/${username}`,
      tiktok: `https://tiktok.com/@${username}`,
      youtube: `https://youtube.com/@${username}`,
      twitter: `https://x.com/${username}`,
      facebook: `https://facebook.com/${username}`,
      pinterest: `https://pinterest.com/${username}`,
      snapchat: `https://snapchat.com/add/${username}`,
      linkedin: `https://linkedin.com/in/${username}`,
    };
    return urls[platform];
  }

  async function handleComplete() {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      // Create creator profile
      const { data: creatorProfile, error: profileError } = await supabase
        .from("creator_profiles")
        .insert({
          user_id: user.id,
          display_name: displayName,
          bio: bio || null,
          niche: selectedNiches,
          location: location || null,
        })
        .select()
        .single();

      if (profileError) throw profileError;

      // Add social accounts
      const validSocials = socials.filter((s) => s.username.trim());
      if (validSocials.length > 0) {
        const socialRecords = validSocials.map((s) => ({
          creator_id: creatorProfile.id,
          platform: s.platform,
          username: s.username.trim().replace(/^@/, ""),
          profile_url: getPlatformUrl(
            s.platform,
            s.username.trim().replace(/^@/, "")
          ),
        }));

        const { error: socialError } = await supabase
          .from("social_accounts")
          .insert(socialRecords);

        if (socialError) throw socialError;
      }

      // Update onboarding status
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          onboarding_status: "completed",
          onboarding_step: TOTAL_STEPS,
          full_name: displayName,
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Set up your creator profile</h1>
          <p className="mt-1 text-muted-foreground">
            Step {step} of {TOTAL_STEPS}
          </p>
          <Progress value={progress} className="mt-4" />
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle>About you</CardTitle>
              </div>
              <CardDescription>
                Tell brands who you are and what you do
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display name *</Label>
                <Input
                  id="displayName"
                  placeholder="Your creator name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell brands about yourself, your content style, and what you're passionate about..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                  {bio.length}/500 characters
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="City, Country"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={() => setStep(2)}
                className="ml-auto"
                disabled={!displayName.trim()}
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 2: Niche Selection */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle>Your niche</CardTitle>
              </div>
              <CardDescription>
                Select up to 5 categories that describe your content (at least 1)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {NICHES.map((niche) => (
                  <Badge
                    key={niche}
                    variant={
                      selectedNiches.includes(niche) ? "default" : "outline"
                    }
                    className="cursor-pointer px-3 py-1.5 text-sm transition-colors"
                    onClick={() => toggleNiche(niche)}
                  >
                    {niche}
                    {selectedNiches.includes(niche) && (
                      <X className="ml-1 h-3 w-3" />
                    )}
                  </Badge>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {selectedNiches.length}/5 selected
              </p>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={selectedNiches.length === 0}
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 3: Social Accounts */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-primary" />
                <CardTitle>Social media</CardTitle>
              </div>
              <CardDescription>
                Add your social media accounts so brands can find you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {socials.map((social, index) => (
                <div key={index} className="flex items-end gap-2">
                  <div className="w-36">
                    <Label className="text-xs">Platform</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                      value={social.platform}
                      onChange={(e) =>
                        updateSocial(
                          index,
                          "platform",
                          e.target.value
                        )
                      }
                    >
                      {PLATFORMS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs">Username</Label>
                    <Input
                      placeholder="@username"
                      value={social.username}
                      onChange={(e) =>
                        updateSocial(index, "username", e.target.value)
                      }
                    />
                  </div>
                  {socials.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSocial(index)}
                      className="h-9 w-9 shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {socials.length < PLATFORMS.length && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addSocial}
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add another platform
                </Button>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={() => setStep(4)}
                disabled={!socials.some((s) => s.username.trim())}
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 4: Review & Complete */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <CardTitle>You&apos;re all set!</CardTitle>
              </div>
              <CardDescription>
                Review your profile and start connecting with brands
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Display Name
                  </p>
                  <p className="font-medium">{displayName}</p>
                </div>
                {bio && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Bio
                    </p>
                    <p className="text-sm">{bio}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Niches
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedNiches.map((niche) => (
                      <Badge key={niche} variant="secondary" className="text-xs">
                        {niche}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Social Accounts
                  </p>
                  <div className="mt-1 space-y-1">
                    {socials
                      .filter((s) => s.username.trim())
                      .map((s, i) => (
                        <p key={i} className="text-sm">
                          {
                            PLATFORMS.find((p) => p.value === s.platform)
                              ?.label
                          }
                          : @{s.username.replace(/^@/, "")}
                        </p>
                      ))}
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleComplete} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Complete setup
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
