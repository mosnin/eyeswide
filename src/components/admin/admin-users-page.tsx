"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Topbar } from "@/components/layout/topbar";
import { Search } from "lucide-react";

interface AdminUsersPageProps {
  users: Record<string, unknown>[];
}

export function AdminUsersPage({ users }: AdminUsersPageProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const filtered = users.filter((u) => {
    const matchesSearch =
      !search ||
      (u.email as string).toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name as string)?.toLowerCase().includes(search.toLowerCase());
    const matchesType =
      typeFilter === "all" || u.account_type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div>
      <Topbar accountType="admin" userName="Admin" title="Users" />

      <div className="p-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            {["all", "creator", "brand", "admin"].map((type) => (
              <Badge
                key={type}
                variant={typeFilter === type ? "default" : "outline"}
                className="cursor-pointer capitalize"
                onClick={() => setTypeFilter(type)}
              >
                {type}
              </Badge>
            ))}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {filtered.length} user{filtered.length !== 1 ? "s" : ""}
        </p>

        {/* Users table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Onboarding</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id as string}>
                    <TableCell className="font-medium">
                      {(user.full_name as string) || "—"}
                    </TableCell>
                    <TableCell>{user.email as string}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {user.account_type as string}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          user.onboarding_status === "completed"
                            ? "bg-green-500/10 text-green-600"
                            : "bg-yellow-500/10 text-yellow-600"
                        }
                      >
                        {user.onboarding_status as string}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(
                        user.created_at as string
                      ).toLocaleDateString()}
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
