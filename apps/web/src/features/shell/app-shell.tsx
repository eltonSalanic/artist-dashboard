"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  CalendarDays,
  Eye,
  LayoutGrid,
  LogOut,
  Settings,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/features/auth/use-session";
import { useMe } from "@/features/auth/use-me";
import {
  PermissionsProvider,
  usePermissions,
} from "@/features/auth/permissions";
import type { MeResponse } from "@/features/auth/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MentionsIndicator } from "@/features/mentions/mentions-indicator";
import { ThemeToggle } from "@/features/shell/theme-toggle";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { session, loading } = useSession();
  const me = useMe(!!session);

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  if (loading || !session || me.isPending) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (me.isError || !me.data?.membership || !me.data.board) {
    return (
      <main className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Something went wrong loading your board. Try reloading.
      </main>
    );
  }

  return (
    <PermissionsProvider role={me.data.membership.role}>
      <Header me={me.data} />
      <div className="flex flex-1 flex-col">{children}</div>
    </PermissionsProvider>
  );
}

function Header({ me }: { me: MeResponse }) {
  const router = useRouter();
  const pathname = usePathname();
  const { role, viewAsUser, setViewAsUser } = usePermissions();
  const initials = me.user.displayName.slice(0, 2).toUpperCase();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const onDashboard = pathname === "/";
  const onCalendar = pathname.startsWith("/calendar");
  const onArchive = pathname.startsWith("/archive");

  return (
    <header className="flex items-center justify-between gap-4 border-b px-6 py-3">
      <Link href="/" className="flex items-center gap-3">
        <span className="font-heading text-sm font-semibold tracking-tight">
          {me.board?.name}
        </span>
        {viewAsUser && (
          <Badge variant="secondary" className="rounded-full">
            <Eye data-icon="inline-start" />
            User view
          </Badge>
        )}
      </Link>

      <nav className="flex items-center gap-1 rounded-full bg-muted/60 p-1">
        <Button
          variant={onDashboard ? "default" : "ghost"}
          size="sm"
          className="rounded-full"
          nativeButton={false}
          render={<Link href="/" />}
        >
          <LayoutGrid data-icon="inline-start" />
          Dashboard
        </Button>
        <Button
          variant={onCalendar ? "default" : "ghost"}
          size="sm"
          className="rounded-full"
          nativeButton={false}
          render={<Link href="/calendar" />}
        >
          <CalendarDays data-icon="inline-start" />
          Calendar
        </Button>
        <Button
          variant={onArchive ? "default" : "ghost"}
          size="sm"
          className="rounded-full"
          nativeButton={false}
          render={<Link href="/archive" />}
        >
          <Archive data-icon="inline-start" />
          Archive
        </Button>
      </nav>

      <div className="flex items-center gap-4">
        <ThemeToggle />
        {me.board && <MentionsIndicator boardId={me.board.id} />}
        {role === "ADMIN" && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            User view
            <Switch checked={viewAsUser} onCheckedChange={setViewAsUser} />
          </label>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Account menu"
                className="rounded-full"
              />
            }
          >
            <Avatar className="size-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="truncate">
                {me.user.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {role === "ADMIN" && (
                <DropdownMenuItem onClick={() => router.push("/settings")}>
                  <Settings data-icon="inline-start" />
                  Settings
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={signOut}>
                <LogOut data-icon="inline-start" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
