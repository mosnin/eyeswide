"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/topbar";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

interface BillingPageProps {
  brandProfile: Record<string, unknown> | null;
}

export function BillingPage({ brandProfile }: BillingPageProps) {
  const subs = brandProfile?.subscriptions as unknown as Record<string, unknown>[] | null;
  const subscription = subs?.[0] ?? null;
  const status = (subscription?.status as string) || "none";
  const isActive = status === "active";
  const isTrialing = status === "trialing";

  async function handleSubscribe() {
    // Call API to create Lemon Squeezy checkout
    const response = await fetch("/api/billing/checkout", {
      method: "POST",
    });
    const data = await response.json();
    if (data.url) {
      window.location.href = data.url;
    }
  }

  async function handleManage() {
    const response = await fetch("/api/billing/portal", {
      method: "POST",
    });
    const data = await response.json();
    if (data.url) {
      window.location.href = data.url;
    }
  }

  return (
    <div>
      <Topbar accountType="brand" userName="" title="Billing" />

      <div className="mx-auto max-w-2xl p-6 space-y-6">
        {/* Current Plan */}
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>
              Manage your subscription and billing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">EyesWide Pro</h3>
                  <Badge
                    variant="secondary"
                    className={
                      isActive
                        ? "bg-green-500/10 text-green-600"
                        : isTrialing
                          ? "bg-yellow-500/10 text-yellow-600"
                          : "bg-gray-500/10 text-gray-600"
                    }
                  >
                    {isActive
                      ? "Active"
                      : isTrialing
                        ? "Trial"
                        : status === "past_due"
                          ? "Past Due"
                          : status === "cancelled"
                            ? "Cancelled"
                            : "Inactive"}
                  </Badge>
                </div>
                <p className="text-2xl font-bold mt-1">
                  $99<span className="text-sm font-normal text-muted-foreground">/month</span>
                </p>
              </div>
              {isActive || isTrialing ? (
                <Button variant="outline" onClick={handleManage}>
                  Manage
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubscribe}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Subscribe
                </Button>
              )}
            </div>

            {/* Trial info */}
            {isTrialing && Boolean(subscription?.trial_ends_at) && (
              <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
                <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Free trial active</p>
                  <p className="text-xs text-muted-foreground">
                    Your trial ends on{" "}
                    {new Date(subscription!.trial_ends_at as string).toLocaleDateString()}.
                    Add a payment method to continue after your trial.
                  </p>
                </div>
              </div>
            )}

            {/* Subscription details */}
            {(isActive || isTrialing) && subscription && (
              <div className="space-y-2 text-sm">
                {Boolean(subscription.current_period_end) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Next billing date</span>
                    <span>
                      {new Date(
                        subscription.current_period_end as string
                      ).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {Boolean(subscription.cancel_at_period_end) && (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">
                      Cancels at end of billing period
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle>What&apos;s included</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {[
                "Unlimited creator discovery & search",
                "Direct outreach to any creator",
                "Campaign management & tracking",
                "In-app messaging with creators",
                "Analytics and performance reporting",
                "Priority customer support",
                "Custom PR package templates",
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
