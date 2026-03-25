"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { AccountType } from "@/types/database";
import {
  LayoutDashboard,
  User,
  Megaphone,
  Users,
  Search,
  Send,
  Settings,
  CreditCard,
  Shield,
  Building2,
  Sparkles,
  BarChart3,
  FileText,
  LogOut,
  Heart,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/supabase/actions";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

function getNavItems(accountType: AccountType): NavItem[] {
  switch (accountType) {
    case "creator":
      return [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "My Profile", href: "/profile", icon: User },
        { label: "Opportunities", href: "/opportunities", icon: Globe },
        { label: "Campaigns", href: "/campaigns", icon: Megaphone },
        { label: "Favorites", href: "/favorites", icon: Heart },
        { label: "Templates", href: "/templates", icon: FileText },
        { label: "Settings", href: "/settings", icon: Settings },
      ];
    case "brand":
      return [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Find Creators", href: "/creators", icon: Search },
        { label: "Outreach", href: "/outreach", icon: Send },
        { label: "Opportunities", href: "/opportunities", icon: Globe },
        { label: "Campaigns", href: "/campaigns", icon: Megaphone },
        { label: "Favorites", href: "/favorites", icon: Heart },
        { label: "Templates", href: "/templates", icon: FileText },
        { label: "Settings", href: "/settings", icon: Settings },
        { label: "Billing", href: "/settings/billing", icon: CreditCard },
      ];
    case "admin":
      return [
        { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
        { label: "Users", href: "/admin/users", icon: Users },
        { label: "Brands", href: "/admin/brands", icon: Building2 },
        { label: "Creators", href: "/admin/creators", icon: Sparkles },
        { label: "Campaigns", href: "/admin/campaigns", icon: Megaphone },
        { label: "Billing", href: "/admin/billing", icon: BarChart3 },
        { label: "Reports", href: "/admin/reports", icon: FileText },
        { label: "Settings", href: "/settings", icon: Settings },
      ];
    default:
      return [];
  }
}

interface SidebarProps {
  accountType: AccountType;
  userName: string;
}

export function Sidebar({ accountType, userName }: SidebarProps) {
  const pathname = usePathname();
  const navItems = getNavItems(accountType);

  const accountLabel =
    accountType === "creator"
      ? "Creator"
      : accountType === "brand"
        ? "Brand"
        : "Admin";

  const AccountIcon =
    accountType === "creator"
      ? Sparkles
      : accountType === "brand"
        ? Building2
        : Shield;

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">EW</span>
          </div>
          <span className="text-lg font-bold">EyesWide</span>
        </Link>
      </div>

      {/* Account badge */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
          <AccountIcon className="h-4 w-4 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">{accountLabel}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              item.href !== "/admin" &&
              pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="border-t p-4">
        <form action={signOut}>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground"
            type="submit"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}
