"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Topbar } from "@/components/layout/topbar";
import Link from "next/link";
import {
  Search,
  MapPin,
  ExternalLink,
  Send,
} from "lucide-react";

interface CreatorDirectoryProps {
  creators: Record<string, unknown>[];
  brandId: string;
}

export function CreatorDirectory({ creators, brandId: _brandId }: CreatorDirectoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null);

  // Get all unique niches
  const allNiches = Array.from(
    new Set(
      creators.flatMap(
        (c) => (c.niche as string[]) || []
      )
    )
  ).sort();

  // Filter creators
  const filteredCreators = creators.filter((creator) => {
    const matchesSearch =
      !searchQuery ||
      (creator.display_name as string)
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (creator.bio as string)
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase());

    const matchesNiche =
      !selectedNiche ||
      ((creator.niche as string[]) || []).includes(selectedNiche);

    return matchesSearch && matchesNiche;
  });

  return (
    <div>
      <Topbar accountType="brand" userName="Brand" title="Find Creators" />

      <div className="p-6 space-y-6">
        {/* Search & Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search creators by name or bio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Niche Filter */}
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={!selectedNiche ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setSelectedNiche(null)}
          >
            All
          </Badge>
          {allNiches.map((niche) => (
            <Badge
              key={niche}
              variant={selectedNiche === niche ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() =>
                setSelectedNiche(selectedNiche === niche ? null : niche)
              }
            >
              {niche}
            </Badge>
          ))}
        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground">
          {filteredCreators.length} creator
          {filteredCreators.length !== 1 ? "s" : ""} found
        </p>

        {/* Creator Grid */}
        {filteredCreators.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">No creators found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCreators.map((creator) => {
              const socials = (creator.social_accounts as Record<string, unknown>[]) || [];
              const initials = ((creator.display_name as string) || "C")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              return (
                <Card key={creator.id as string} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold truncate">
                          {creator.display_name as string}
                        </h3>
                        {Boolean(creator.location) && (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {creator.location as string}
                          </p>
                        )}
                      </div>
                    </div>

                    {Boolean(creator.bio) && (
                      <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                        {creator.bio as string}
                      </p>
                    )}

                    {/* Niches */}
                    <div className="mt-3 flex flex-wrap gap-1">
                      {((creator.niche as string[]) || []).map((niche) => (
                        <Badge
                          key={niche}
                          variant="secondary"
                          className="text-xs"
                        >
                          {niche}
                        </Badge>
                      ))}
                    </div>

                    {/* Social accounts */}
                    {socials.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {socials.map((social) => (
                          <a
                            key={social.id as string}
                            href={social.profile_url as string}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {social.platform as string}
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Action */}
                    <div className="mt-4">
                      <Button size="sm" className="w-full" render={<Link href={`/outreach?creator=${creator.id}`} />}>
                          <Send className="mr-2 h-3 w-3" />
                          Send PR Package Offer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
