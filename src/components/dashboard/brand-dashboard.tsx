"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/topbar";
import Link from "next/link";
import {
  Users,
  Send,
  CheckCircle2,
  Clock,
  ArrowRight,
  Search,
  CreditCard,
  AlertCircle,
} from "lucide-react";

interface BrandDashboardProps {
  profile: Record<string, unknown>;
  brandProfile: Record<string, unknown> | null;
  recentCampaigns: Record<string, unknown>[];
  totalCreators: number;
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

export function BrandDashboard({
  profile,
  brandProfile,
  recentCampaigns,
  totalCreators,
}: BrandDashboardProps) {
  const subs = brandProfile?.subscriptions as unknown as Record<string, unknown>[] | null;
  const subscription = subs?.[0] ?? null;
  const isTrialing = subscription?.status === "trialing";
  const isActive = subscription?.status === "active" || isTrialing;

  const pendingCount = recentCampaigns.filter(
    (c) => c.status === "pending"
  ).length;
  const activeCount = recentCampaigns.filter(
    (c) => c.status === "accepted" || c.status === "in_progress"
  ).length;

  return (
    <div>
      <Topbar
        accountType="brand"
        userName={(profile.full_name as string) || "Brand"}
        title="Dashboard"
      />

      <div className="p-6 space-y-6">
        {/* Welcome */}
        <div>
          <h2 className="text-2xl font-bold">
            Welcome back,{" "}
            {(brandProfile?.company_name as string) || "Brand"}
          </h2>
          <p className="text-muted-foreground">
            Find creators and manage your PR campaigns
          </p>
        </div>

        {/* Trial/Subscription Banner */}
        {isTrialing && (
          <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
            <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                You&apos;re on a free trial
              </p>
              <p className="text-xs text-muted-foreground">
                Your trial ends on{" "}
                {subscription?.trial_ends_at
                  ? new Date(
                      subscription.trial_ends_at as string
                    ).toLocaleDateString()
                  : "soon"}
                . Add billing to continue after your trial.
              </p>
            </div>
            <Button size="sm" render={<Link href="/settings/billing" />}>
                <CreditCard className="mr-2 h-4 w-4" />
                Add billing
            </Button>
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCreators}</p>
                <p className="text-sm text-muted-foreground">
                  Available creators
                </p>
              </div>
            </CardContent>
          </Card>
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
                <Send className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-sm text-muted-foreground">Active campaigns</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {
                    recentCampaigns.filter((c) => c.status === "completed")
                      .length
                  }
                </p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <Link href="/creators">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Search className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Find Creators</p>
                  <p className="text-sm text-muted-foreground">
                    Browse and discover creators for your brand
                  </p>
                </div>
                <ArrowRight className="ml-auto h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Link>
          </Card>
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <Link href="/outreach">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                  <Send className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">New Campaign</p>
                  <p className="text-sm text-muted-foreground">
                    Reach out to a creator with a PR package
                  </p>
                </div>
                <ArrowRight className="ml-auto h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Link>
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
                <Send className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="font-medium">No campaigns yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Find creators and send your first PR package campaign.
                </p>
                <Button className="mt-4" render={<Link href="/creators" />}>Find creators</Button>
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
                        {(
                          campaign.creator_profiles as Record<string, unknown>
                        )?.display_name as string}
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
