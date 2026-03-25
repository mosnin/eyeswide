import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
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

export default async function AdminBrandsPage() {
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

  const { data: brands } = await supabase
    .from("brand_profiles")
    .select("*, profiles(email), subscriptions(status, plan)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <Topbar accountType="admin" userName="Admin" title="Brands" />
      <div className="p-6">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(brands || []).map((brand) => {
                  const sub = brand.subscriptions as Record<string, unknown> | null;
                  return (
                    <TableRow key={brand.id}>
                      <TableCell className="font-medium">
                        {brand.company_name}
                      </TableCell>
                      <TableCell>{brand.industry}</TableCell>
                      <TableCell>
                        {(brand.profiles as Record<string, unknown>)?.email as string}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            sub?.status === "active"
                              ? "bg-green-500/10 text-green-600"
                              : sub?.status === "trialing"
                                ? "bg-yellow-500/10 text-yellow-600"
                                : ""
                          }
                        >
                          {(sub?.status as string) || "none"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(brand.created_at).toLocaleDateString()}
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
