"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Topbar } from "@/components/layout/topbar";
import Link from "next/link";
import type { AccountType } from "@/types/database";
import { Heart, Send, ExternalLink, Building2, Sparkles } from "lucide-react";

interface FavoritesPageProps {
  accountType: string;
  favoriteCreators: Record<string, unknown>[];
  favoriteBrands: Record<string, unknown>[];
}

export function FavoritesPage({
  accountType,
  favoriteCreators,
  favoriteBrands,
}: FavoritesPageProps) {
  const items = accountType === "brand" ? favoriteCreators : favoriteBrands;
  const emptyIcon = accountType === "brand" ? Sparkles : Building2;
  const EmptyIcon = emptyIcon;

  return (
    <div>
      <Topbar
        accountType={accountType as AccountType}
        userName=""
        title="Favorites"
      />

      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold">
            Saved {accountType === "brand" ? "Creators" : "Brands"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {accountType === "brand"
              ? "Creators you've saved for future outreach"
              : "Brands you're interested in working with"}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Heart className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">No favorites yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {accountType === "brand"
                ? "Browse creators and save your favorites for later."
                : "Save brands you want to work with."}
            </p>
            {accountType === "brand" && (
              <Button className="mt-4" render={<Link href="/creators" />}>
                Browse Creators
              </Button>
            )}
          </div>
        ) : accountType === "brand" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favoriteCreators.map((creator) => {
              const initials = ((creator.display_name as string) || "C")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              const socials = (creator.social_accounts as Record<string, unknown>[]) || [];

              return (
                <Card key={creator.id as string}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">
                          {creator.display_name as string}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {((creator.niche as string[]) || []).map((n) => (
                            <Badge key={n} variant="secondary" className="text-xs">
                              {n}
                            </Badge>
                          ))}
                        </div>
                        {socials.length > 0 && (
                          <div className="mt-2 flex gap-2">
                            {socials.slice(0, 3).map((s) => (
                              <span
                                key={s.platform as string}
                                className="text-xs text-muted-foreground"
                              >
                                {s.platform as string}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      className="mt-4 w-full"
                      size="sm"
                      render={<Link href={`/outreach?creator=${creator.id}`} />}
                    >
                      <Send className="mr-2 h-3 w-3" />
                      Send Offer
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favoriteBrands.map((brand) => (
              <Card key={brand.id as string}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">
                        {brand.company_name as string}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {brand.industry as string}
                      </p>
                    </div>
                  </div>
                  {Boolean(brand.description) && (
                    <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                      {brand.description as string}
                    </p>
                  )}
                  {Boolean(brand.website) && (
                    <a
                      href={brand.website as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Visit website
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
