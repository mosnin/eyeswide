"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Topbar } from "@/components/layout/topbar";
import { Megaphone, Search, Calendar, ArrowRight } from "lucide-react";
import type { AccountType } from "@/types/database";

interface CampaignsListProps {
  campaigns: Record<string, unknown>[];
  accountType: string;
}

const STATUS_FILTERS = [
  "all",
  "pending",
  "accepted",
  "in_progress",
  "completed",
  "rejected",
  "cancelled",
];

function getStatusColor(status: string) {
  switch (status) {
    case "pending":
      return "bg-yellow-500/10 text-yellow-600";
    case "accepted":
    case "in_progress":
      return "bg-blue-500/10 text-blue-600";
    case "completed":
      return "bg-green-500/10 text-green-600";
    case "rejected":
    case "cancelled":
      return "bg-red-500/10 text-red-600";
    case "draft":
      return "bg-gray-500/10 text-gray-600";
    default:
      return "bg-gray-500/10 text-gray-600";
  }
}

export function CampaignsList({ campaigns, accountType }: CampaignsListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = campaigns.filter((c) => {
    const matchesSearch =
      !search ||
      (c.title as string).toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <Topbar
        accountType={accountType as AccountType}
        userName=""
        title="Campaigns"
      />

      <div className="p-6 space-y-6">
        {/* Search & Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search campaigns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          {accountType === "brand" && (
            <Button render={<Link href="/outreach" />}>New Campaign</Button>
          )}
        </div>

        {/* Status filters */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((status) => (
            <Badge
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              className="cursor-pointer capitalize"
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </Badge>
          ))}
        </div>

        {/* Campaign list */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Megaphone className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">No campaigns found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {campaigns.length === 0
                ? accountType === "brand"
                  ? "Send your first PR package offer to a creator."
                  : "When brands reach out, campaigns will appear here."
                : "Try adjusting your filters."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((campaign) => {
              const otherParty =
                accountType === "brand"
                  ? (campaign.creator_profiles as Record<string, unknown>)
                  : (campaign.brand_profiles as Record<string, unknown>);

              const otherName =
                accountType === "brand"
                  ? (otherParty?.display_name as string)
                  : (otherParty?.company_name as string);

              return (
                <Link
                  key={campaign.id as string}
                  href={`/campaigns/${campaign.id}`}
                >
                  <Card className="transition-colors hover:bg-muted/50 cursor-pointer">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">
                            {campaign.title as string}
                          </h3>
                          <Badge
                            variant="secondary"
                            className={getStatusColor(
                              campaign.status as string
                            )}
                          >
                            {campaign.status as string}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {accountType === "brand" ? "Creator" : "Brand"}:{" "}
                          {otherName || "Unknown"}
                        </p>
                        {Boolean(campaign.deadline) && (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            Deadline:{" "}
                            {new Date(
                              campaign.deadline as string
                            ).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
