"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Topbar } from "@/components/layout/topbar";
import Link from "next/link";
import type { AccountType } from "@/types/database";
import {
  Search,
  Megaphone,
  Building2,
  Calendar,
  Users,
  CheckCircle2,
  Loader2,
  Plus,
  Send,
} from "lucide-react";

interface OpportunitiesFeedProps {
  opportunities: Record<string, unknown>[];
  accountType: string;
  creatorId: string | null;
  brandId: string | null;
  appliedOpportunityIds: string[];
}

export function OpportunitiesFeed({
  opportunities,
  accountType,
  creatorId,
  brandId,
  appliedOpportunityIds,
}: OpportunitiesFeedProps) {
  const [search, setSearch] = useState("");
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null);
  const [applyingTo, setApplyingTo] = useState<string | null>(null);
  const [applicationMessage, setApplicationMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [appliedIds, setAppliedIds] = useState<string[]>(appliedOpportunityIds);
  const router = useRouter();

  const allNiches = Array.from(
    new Set(opportunities.flatMap((o) => (o.niches as string[]) || []))
  ).sort();

  const filtered = opportunities.filter((o) => {
    const matchesSearch =
      !search ||
      (o.title as string).toLowerCase().includes(search.toLowerCase()) ||
      (o.description as string).toLowerCase().includes(search.toLowerCase());
    const matchesNiche =
      !selectedNiche ||
      ((o.niches as string[]) || []).includes(selectedNiche);
    return matchesSearch && matchesNiche;
  });

  async function handleApply(opportunityId: string) {
    if (!creatorId) return;
    setSubmitting(true);

    const supabase = createClient();
    await supabase.from("opportunity_applications").insert({
      opportunity_id: opportunityId,
      creator_id: creatorId,
      message: applicationMessage || null,
    });

    setAppliedIds([...appliedIds, opportunityId]);
    setApplyingTo(null);
    setApplicationMessage("");
    setSubmitting(false);
    router.refresh();
  }

  return (
    <div>
      <Topbar
        accountType={accountType as AccountType}
        userName=""
        title="Opportunities"
      />

      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">
              {accountType === "brand"
                ? "Your Posted Opportunities"
                : "Open Opportunities"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {accountType === "brand"
                ? "Manage your open PR package opportunities"
                : "Browse and apply to brand opportunities for PR packages"}
            </p>
          </div>
          {accountType === "brand" && (
            <Button render={<Link href="/opportunities/create" />}>
              <Plus className="mr-2 h-4 w-4" />
              Post Opportunity
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search opportunities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Niche filters */}
        {allNiches.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={!selectedNiche ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedNiche(null)}
            >
              All
            </Badge>
            {allNiches.map((niche) => (
              <Badge
                key={niche}
                variant={selectedNiche === niche ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() =>
                  setSelectedNiche(selectedNiche === niche ? null : niche)
                }
              >
                {niche}
              </Badge>
            ))}
          </div>
        )}

        {/* Opportunities list */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Megaphone className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">No opportunities found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {accountType === "brand"
                ? "Post your first opportunity to attract creators."
                : "Check back later for new brand opportunities."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((opp) => {
              const brand = opp.brand_profiles as Record<string, unknown>;
              const hasApplied = appliedIds.includes(opp.id as string);
              const deadline = opp.deadline as string | null;
              const niches: string[] = (opp.niches as string[]) || [];

              return (
                <Card key={opp.id as string}>
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-semibold">
                            {opp.title as string}
                          </h3>
                          <Badge variant="secondary" className="capitalize">
                            {(opp.compensation_type as string).replace(
                              /_/g,
                              " "
                            )}
                          </Badge>
                        </div>

                        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          <span>{brand?.company_name as string}</span>
                          {Boolean(brand?.industry) && (
                            <>
                              <span>·</span>
                              <span>{brand.industry as string}</span>
                            </>
                          )}
                        </div>

                        <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                          {opp.description as string}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-1">
                          {niches.map((niche) => (
                            <Badge
                              key={niche}
                              variant="outline"
                              className="text-xs"
                            >
                              {niche}
                            </Badge>
                          ))}
                        </div>

                        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                          {deadline && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Deadline:{" "}
                              {new Date(deadline).toLocaleDateString()}
                            </span>
                          )}
                          {Boolean(opp.max_creators) && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {opp.max_creators as number} spots
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Apply button for creators */}
                      {accountType === "creator" && creatorId && (
                        <div className="shrink-0">
                          {hasApplied ? (
                            <Button disabled variant="outline" size="sm">
                              <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                              Applied
                            </Button>
                          ) : (
                            <Dialog
                              open={applyingTo === (opp.id as string)}
                              onOpenChange={(open) =>
                                setApplyingTo(
                                  open ? (opp.id as string) : null
                                )
                              }
                            >
                              <DialogTrigger
                                render={<Button size="sm" />}
                              >
                                <Send className="mr-2 h-3 w-3" />
                                Apply
                              </DialogTrigger>
                              <DialogPortal>
                                <DialogOverlay />
                                <DialogContent>
                                  <DialogTitle className="text-lg font-semibold">
                                    Apply to &quot;{opp.title as string}&quot;
                                  </DialogTitle>
                                  <DialogDescription className="mt-1 text-sm text-muted-foreground">
                                    Send a message to the brand with your
                                    application.
                                  </DialogDescription>
                                  <Textarea
                                    className="mt-4"
                                    placeholder="Tell the brand why you'd be a great fit for this opportunity..."
                                    value={applicationMessage}
                                    onChange={(e) =>
                                      setApplicationMessage(e.target.value)
                                    }
                                    rows={4}
                                  />
                                  <div className="mt-4 flex justify-end gap-2">
                                    <DialogClose
                                      render={
                                        <Button variant="outline" size="sm" />
                                      }
                                    >
                                      Cancel
                                    </DialogClose>
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        handleApply(opp.id as string)
                                      }
                                      disabled={submitting}
                                    >
                                      {submitting ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <Send className="mr-2 h-4 w-4" />
                                      )}
                                      Submit Application
                                    </Button>
                                  </div>
                                </DialogContent>
                              </DialogPortal>
                            </Dialog>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
