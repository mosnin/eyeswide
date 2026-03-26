"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Topbar } from "@/components/layout/topbar";
import Link from "next/link";
import {
  Users,
  Sparkles,
  Building2,
  Megaphone,
  CreditCard,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

interface AdminDashboardProps {
  stats: {
    totalUsers: number;
    totalCreators: number;
    totalBrands: number;
    totalCampaigns: number;
    activeCampaigns: number;
    activeSubscriptions: number;
  };
  recentUsers: Record<string, unknown>[];
  recentCampaigns: Record<string, unknown>[];
}

export function AdminDashboard({
  stats,
  recentUsers,
  recentCampaigns,
}: AdminDashboardProps) {
  return (
    <div>
      <Topbar accountType="admin" userName="Admin" title="Admin Dashboard" />

      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                  <p className="text-xs text-muted-foreground">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalCreators}</p>
                  <p className="text-xs text-muted-foreground">Creators</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalBrands}</p>
                  <p className="text-xs text-muted-foreground">Brands</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Megaphone className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalCampaigns}</p>
                  <p className="text-xs text-muted-foreground">Campaigns</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.activeCampaigns}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {stats.activeSubscriptions}
                  </p>
                  <p className="text-xs text-muted-foreground">Subscribers</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Estimate */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Estimated MRR
                </p>
                <p className="text-3xl font-bold">
                  ${(stats.activeSubscriptions * 99).toLocaleString()}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                {stats.activeSubscriptions} active subscriptions x $99/mo
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Users */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Users</CardTitle>
              <Link
                href="/admin/users"
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentUsers.map((user) => (
                  <div
                    key={user.id as string}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-sm">
                        {(user.full_name as string) || (user.email as string)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user.email as string}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {user.account_type as string}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(
                          user.created_at as string
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Campaigns */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Campaigns</CardTitle>
              <Link
                href="/admin/campaigns"
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentCampaigns.map((campaign) => (
                  <div
                    key={campaign.id as string}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-sm">
                        {campaign.title as string}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {
                          (campaign.brand_profiles as Record<string, unknown>)
                            ?.company_name as string
                        }{" "}
                        →{" "}
                        {
                          (
                            campaign.creator_profiles as Record<
                              string,
                              unknown
                            >
                          )?.display_name as string
                        }
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">
                      {campaign.status as string}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
