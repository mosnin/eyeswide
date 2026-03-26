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

export default async function AdminCreatorsPage() {
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

  const { data: creators } = await supabase
    .from("creator_profiles")
    .select("*, profiles(email), social_accounts(platform)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <Topbar accountType="admin" userName="Admin" title="Creators" />
      <div className="p-6">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Niches</TableHead>
                  <TableHead>Platforms</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(creators || []).map((creator) => {
                  const socials = (creator.social_accounts as Record<string, unknown>[]) || [];
                  return (
                    <TableRow key={creator.id}>
                      <TableCell className="font-medium">
                        {creator.display_name}
                      </TableCell>
                      <TableCell>
                        {(creator.profiles as Record<string, unknown>)?.email as string}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(creator.niche as string[] || []).slice(0, 2).map((n) => (
                            <Badge key={n} variant="secondary" className="text-xs">
                              {n}
                            </Badge>
                          ))}
                          {(creator.niche as string[])?.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{(creator.niche as string[]).length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {socials.length} platform{socials.length !== 1 ? "s" : ""}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            creator.is_available
                              ? "bg-green-500/10 text-green-600"
                              : "bg-red-500/10 text-red-600"
                          }
                        >
                          {creator.is_available ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(creator.created_at).toLocaleDateString()}
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
