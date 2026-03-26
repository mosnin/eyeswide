import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Topbar } from "@/components/layout/topbar";

export default async function AdminBillingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", user.id)
    .single();

  if (!profile || profile.account_type !== "admin") redirect("/dashboard");

  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select("*, brand_profiles(company_name, profiles(email))")
    .order("created_at", { ascending: false });

  const active = (subscriptions || []).filter((s) => s.status === "active").length;
  const trialing = (subscriptions || []).filter((s) => s.status === "trialing").length;
  const cancelled = (subscriptions || []).filter((s) => s.status === "cancelled").length;

  return (
    <div>
      <Topbar accountType="admin" userName="Admin" title="Billing Overview" />
      <div className="p-6 space-y-6">
        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">${(active * 99).toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">MRR</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{active}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{trialing}</p>
              <p className="text-sm text-muted-foreground">Trialing</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{cancelled}</p>
              <p className="text-sm text-muted-foreground">Cancelled</p>
            </CardContent>
          </Card>
        </div>

        {/* Subscription table */}
        <Card>
          <CardHeader>
            <CardTitle>All Subscriptions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trial Ends</TableHead>
                  <TableHead>Next Billing</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(subscriptions || []).map((sub) => {
                  const brand = sub.brand_profiles as Record<string, unknown>;
                  return (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">
                        {brand?.company_name as string}
                      </TableCell>
                      <TableCell className="capitalize">{sub.plan}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            sub.status === "active"
                              ? "bg-green-500/10 text-green-600"
                              : sub.status === "trialing"
                                ? "bg-yellow-500/10 text-yellow-600"
                                : sub.status === "past_due"
                                  ? "bg-red-500/10 text-red-600"
                                  : ""
                          }
                        >
                          {sub.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sub.trial_ends_at
                          ? new Date(sub.trial_ends_at).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sub.current_period_end
                          ? new Date(sub.current_period_end).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(sub.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
