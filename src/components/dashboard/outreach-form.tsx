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
import { Loader2, Send, X, Plus } from "lucide-react";

interface OutreachFormProps {
  brandId: string;
  brandName: string;
  creators: Record<string, unknown>[];
  selectedCreator: Record<string, unknown> | null;
}

export function OutreachForm({
  brandId,
  brandName,
  creators,
  selectedCreator,
}: OutreachFormProps) {
  const [creatorId, setCreatorId] = useState(
    (selectedCreator?.id as string) || ""
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [deliverable, setDeliverable] = useState("");
  const [deliverables, setDeliverables] = useState<string[]>([]);
  const [compensationType, setCompensationType] = useState("product_only");
  const [compensationDetails, setCompensationDetails] = useState("");
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function addDeliverable() {
    if (deliverable.trim()) {
      setDeliverables([...deliverables, deliverable.trim()]);
      setDeliverable("");
    }
  }

  function removeDeliverable(index: number) {
    setDeliverables(deliverables.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const { error: insertError } = await supabase.from("campaigns").insert({
        brand_id: brandId,
        creator_id: creatorId,
        title,
        description,
        requirements,
        deliverables,
        compensation_type: compensationType,
        compensation_details: compensationDetails || null,
        deadline: deadline || null,
        status: "pending",
      });

      if (insertError) throw insertError;

      router.push("/campaigns");
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
        userName={brandName}
        title="Send PR Package Offer"
      />

      <div className="mx-auto max-w-2xl p-6">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>New Campaign</CardTitle>
              <CardDescription>
                Create a PR package offer for a creator. They&apos;ll be
                notified and can accept or decline.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Creator Selection */}
              <div className="space-y-2">
                <Label htmlFor="creator">Creator *</Label>
                <select
                  id="creator"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                  value={creatorId}
                  onChange={(e) => setCreatorId(e.target.value)}
                  required
                >
                  <option value="">Select a creator</option>
                  {creators.map((c) => (
                    <option key={c.id as string} value={c.id as string}>
                      {c.display_name as string} —{" "}
                      {((c.niche as string[]) || []).join(", ")}
                    </option>
                  ))}
                </select>
              </div>

              {/* Campaign Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Campaign title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Summer Collection PR Package"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the PR package and what you're offering the creator..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  required
                />
              </div>

              {/* Requirements / Terms */}
              <div className="space-y-2">
                <Label htmlFor="requirements">
                  Requirements & Terms *
                </Label>
                <Textarea
                  id="requirements"
                  placeholder="What does the creator need to do? Posts required, timeline, usage rights, etc."
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  rows={4}
                  required
                />
              </div>

              {/* Deliverables */}
              <div className="space-y-2">
                <Label>Deliverables</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., 1 Instagram Reel"
                    value={deliverable}
                    onChange={(e) => setDeliverable(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addDeliverable();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={addDeliverable}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {deliverables.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {deliverables.map((d, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {d}
                        <button
                          type="button"
                          onClick={() => removeDeliverable(i)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Compensation */}
              <div className="space-y-2">
                <Label>Compensation type *</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                  value={compensationType}
                  onChange={(e) => setCompensationType(e.target.value)}
                >
                  <option value="product_only">Product only</option>
                  <option value="product_and_payment">
                    Product + Payment
                  </option>
                  <option value="payment_only">Payment only</option>
                </select>
              </div>

              {compensationType !== "product_only" && (
                <div className="space-y-2">
                  <Label htmlFor="compensationDetails">
                    Compensation details
                  </Label>
                  <Input
                    id="compensationDetails"
                    placeholder="e.g., $500 flat fee"
                    value={compensationDetails}
                    onChange={(e) => setCompensationDetails(e.target.value)}
                  />
                </div>
              )}

              {/* Deadline */}
              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline (optional)</Label>
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
              <Button
                type="submit"
                disabled={loading || !creatorId || !title || !description}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send offer
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </div>
  );
}
