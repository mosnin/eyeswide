"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/topbar";
import Link from "next/link";
import {
  Megaphone,
  Eye,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface CreatorDashboardProps {
  profile: Record<string, unknown>;
  creatorProfile: Record<string, unknown> | null;
  recentCampaigns: Record<string, unknown>[];
}

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
    default:
      return "bg-gray-500/10 text-gray-600";
  }
}

export function CreatorDashboard({
  profile,
  creatorProfile,
  recentCampaigns,
}: CreatorDashboardProps) {
  const pendingCount = recentCampaigns.filter(
    (c) => c.status === "pending"
  ).length;
  const activeCount = recentCampaigns.filter(
    (c) => c.status === "accepted" || c.status === "in_progress"
  ).length;
  const completedCount = recentCampaigns.filter(
    (c) => c.status === "completed"
  ).length;

  return (
    <div>
      <Topbar
        accountType="creator"
        userName={(profile.full_name as string) || "Creator"}
        title="Dashboard"
      />

      <div className="p-6 space-y-6">
        {/* Welcome */}
        <div>
          <h2 className="text-2xl font-bold">
            Welcome back, {(creatorProfile?.display_name as string) || "Creator"}
          </h2>
          <p className="text-muted-foreground">
            Here&apos;s what&apos;s happening with your campaigns
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Megaphone className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedCount}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {(creatorProfile as Record<string, unknown>)?.is_available
                    ? "Yes"
                    : "No"}
                </p>
                <p className="text-sm text-muted-foreground">Available</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Campaigns */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Campaigns</CardTitle>
            <Button variant="ghost" size="sm" render={<Link href="/campaigns" />}>
                View all <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentCampaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Sparkles className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="font-medium">No campaigns yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  When brands reach out to you, their campaigns will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentCampaigns.map((campaign) => (
                  <Link
                    key={campaign.id as string}
                    href={`/campaigns/${campaign.id}`}
                    className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {campaign.title as string}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {(campaign.brand_profiles as Record<string, unknown>)
                          ?.company_name as string}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={getStatusColor(campaign.status as string)}
                    >
                      {campaign.status as string}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
