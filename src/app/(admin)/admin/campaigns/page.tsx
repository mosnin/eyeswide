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

export default async function AdminCampaignsPage() {
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

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*, brand_profiles(company_name), creator_profiles(display_name)")
    .order("created_at", { ascending: false });

  function getStatusColor(status: string) {
    switch (status) {
      case "pending": return "bg-yellow-500/10 text-yellow-600";
      case "accepted": case "in_progress": return "bg-blue-500/10 text-blue-600";
      case "completed": return "bg-green-500/10 text-green-600";
      case "rejected": case "cancelled": return "bg-red-500/10 text-red-600";
      default: return "";
    }
  }

  return (
    <div>
      <Topbar accountType="admin" userName="Admin" title="Campaigns" />
      <div className="p-6">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(campaigns || []).map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium max-w-48 truncate">
                      {campaign.title}
                    </TableCell>
                    <TableCell>
                      {(campaign.brand_profiles as Record<string, unknown>)?.company_name as string}
                    </TableCell>
                    <TableCell>
                      {(campaign.creator_profiles as Record<string, unknown>)?.display_name as string}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getStatusColor(campaign.status)}>
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize text-sm">
                      {campaign.compensation_type.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(campaign.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
