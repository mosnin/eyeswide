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
import { Topbar } from "@/components/layout/topbar";
import { Loader2, X, Megaphone } from "lucide-react";

const NICHES = [
  "Beauty", "Fashion", "Fitness", "Food", "Gaming", "Health",
  "Home Decor", "Lifestyle", "Music", "Parenting", "Pets",
  "Photography", "Sports", "Tech", "Travel", "Wellness",
];

export default function CreateOpportunityPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [compensationType, setCompensationType] = useState("product_only");
  const [compensationDetails, setCompensationDetails] = useState("");
  const [deadline, setDeadline] = useState("");
  const [maxCreators, setMaxCreators] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function toggleNiche(niche: string) {
    setSelectedNiches((prev) =>
      prev.includes(niche) ? prev.filter((n) => n !== niche) : [...prev, niche]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      const { data: brandProfile } = await supabase
        .from("brand_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!brandProfile) throw new Error("Brand profile not found");

      const { error: insertError } = await supabase
        .from("opportunities")
        .insert({
          brand_id: brandProfile.id,
          title,
          description,
          requirements: requirements || null,
          niches: selectedNiches,
          compensation_type: compensationType,
          compensation_details: compensationDetails || null,
          deadline: deadline || null,
          max_creators: maxCreators ? parseInt(maxCreators) : null,
        });

      if (insertError) throw insertError;

      router.push("/opportunities");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div>
      <Topbar
        accountType="brand"
        userName=""
        title="Post Opportunity"
      />
      <div className="mx-auto max-w-2xl p-6">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                <CardTitle>New Opportunity</CardTitle>
              </div>
              <CardDescription>
                Post an open PR package opportunity for creators to apply to
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Looking for Beauty Creators for Summer Launch"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the opportunity, what you're offering, and what kind of creators you're looking for..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="requirements">Requirements</Label>
                <Textarea
                  id="requirements"
                  placeholder="Minimum follower count, content requirements, posting schedule..."
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Target niches</Label>
                <div className="flex flex-wrap gap-2">
                  {NICHES.map((niche) => (
                    <Badge
                      key={niche}
                      variant={selectedNiches.includes(niche) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleNiche(niche)}
                    >
                      {niche}
                      {selectedNiches.includes(niche) && (
                        <X className="ml-1 h-3 w-3" />
                      )}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Compensation</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={compensationType}
                    onChange={(e) => setCompensationType(e.target.value)}
                  >
                    <option value="product_only">Product only</option>
                    <option value="product_and_payment">Product + Payment</option>
                    <option value="payment_only">Payment only</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxCreators">Max creators</Label>
                  <Input
                    id="maxCreators"
                    type="number"
                    min="1"
                    placeholder="e.g., 10"
                    value={maxCreators}
                    onChange={(e) => setMaxCreators(e.target.value)}
                  />
                </div>
              </div>

              {compensationType !== "product_only" && (
                <div className="space-y-2">
                  <Label>Compensation details</Label>
                  <Input
                    placeholder="e.g., $200-500 per creator"
                    value={compensationDetails}
                    onChange={(e) => setCompensationDetails(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="deadline">Application deadline</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !title || !description}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Post Opportunity
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </div>
  );
}
