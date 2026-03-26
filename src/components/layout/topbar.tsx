"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Sidebar } from "./sidebar";
import type { AccountType } from "@/types/database";

interface TopbarProps {
  accountType: AccountType;
  userName: string;
  title?: string;
}

export function Topbar({ accountType, userName, title }: TopbarProps) {
  return (
    <header className="flex h-14 items-center border-b bg-background px-4 lg:px-6">
      {/* Mobile menu */}
      <Sheet>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" />}>
            <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-60 p-0">
          <Sidebar accountType={accountType} userName={userName} />
        </SheetContent>
      </Sheet>

      {title && (
        <h1 className="text-xl font-semibold">{title}</h1>
      )}
    </header>
  );
}
