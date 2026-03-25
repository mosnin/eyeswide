"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Topbar } from "@/components/layout/topbar";
import { Loader2, Save, ExternalLink, MapPin, Plus, X } from "lucide-react";
import type { SocialPlatform } from "@/types/database";

const NICHES = [
  "Beauty", "Fashion", "Fitness", "Food", "Gaming", "Health",
  "Home Decor", "Lifestyle", "Music", "Parenting", "Pets",
  "Photography", "Sports", "Tech", "Travel", "Wellness",
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

interface CreatorProfilePageProps {
  creatorProfile: Record<string, unknown>;
}

export function CreatorProfilePage({ creatorProfile }: CreatorProfilePageProps) {
  const [displayName, setDisplayName] = useState(creatorProfile.display_name as string);
  const [bio, setBio] = useState((creatorProfile.bio as string) || "");
  const [location, setLocation] = useState((creatorProfile.location as string) || "");
  const [website, setWebsite] = useState((creatorProfile.website as string) || "");
  const [isAvailable, setIsAvailable] = useState(creatorProfile.is_available as boolean);
  const [selectedNiches, setSelectedNiches] = useState<string[]>(
    (creatorProfile.niche as string[]) || []
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const socials = (creatorProfile.social_accounts as Record<string, unknown>[]) || [];

  function toggleNiche(niche: string) {
    setSelectedNiches((prev) =>
      prev.includes(niche)
        ? prev.filter((n) => n !== niche)
        : prev.length < 5
          ? [...prev, niche]
          : prev
    );
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("creator_profiles")
      .update({
        display_name: displayName,
        bio: bio || null,
        location: location || null,
        website: website || null,
        niche: selectedNiches,
        is_available: isAvailable,
      })
      .eq("id", creatorProfile.id);

    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    }
  }

  return (
    <div>
      <Topbar accountType="creator" userName={displayName} title="My Profile" />

      <div className="mx-auto max-w-2xl p-6 space-y-6">
        {/* Availability Toggle */}
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="font-medium">Available for PR packages</p>
              <p className="text-sm text-muted-foreground">
                When enabled, brands can find and reach out to you
              </p>
            </div>
            <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
          </CardContent>
        </Card>

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">{bio.length}/500</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, Country"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yoursite.com"
              />
            </div>
          </CardContent>
        </Card>

        {/* Niches */}
        <Card>
          <CardHeader>
            <CardTitle>Niches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {NICHES.map((niche) => (
                <Badge
                  key={niche}
                  variant={selectedNiches.includes(niche) ? "default" : "outline"}
                  className="cursor-pointer px-3 py-1.5"
                  onClick={() => toggleNiche(niche)}
                >
                  {niche}
                  {selectedNiches.includes(niche) && <X className="ml-1 h-3 w-3" />}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Social Accounts (read-only view, manage in settings) */}
        <Card>
          <CardHeader>
            <CardTitle>Social Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            {socials.length === 0 ? (
              <p className="text-sm text-muted-foreground">No social accounts linked.</p>
            ) : (
              <div className="space-y-2">
                {socials.map((social) => (
                  <div
                    key={social.id as string}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium capitalize">
                        {PLATFORMS.find((p) => p.value === social.platform)?.label || social.platform as string}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        @{social.username as string}
                      </p>
                    </div>
                    <a
                      href={social.profile_url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saved ? "Saved!" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
