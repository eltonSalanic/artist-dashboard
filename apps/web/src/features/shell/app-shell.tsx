"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  CalendarDays,
  Check,
  ChevronsUpDown,
  Eye,
  LayoutGrid,
  LogOut,
  Plus,
  Settings,
  Wallet,
} from "lucide-react";
import { auth } from "@/lib/auth";
import {
  PermissionsProvider,
  toUserMessage,
  usePermissions,
  useSession,
} from "@artist/api-client";
import { ErrorState } from "@/components/error-state";
import { selectBoard, useMe } from "@/lib/use-me";
import type { MeResponse } from "@artist/api-client";
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
import { CreateBandDialog } from "@/features/shell/create-band-dialog";
import { NoBand } from "@/features/shell/no-band";
import { SubscriptionPaywall } from "@/features/billing/subscription-paywall";

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

  if (me.data && me.data.boards.length === 0) {
    return <NoBand email={me.data.user.email} />;
  }

  if (me.isError || !me.data?.membership || !me.data.board) {
    return (
      <main className="flex flex-1">
        <ErrorState
          title="Couldn't load your band"
          message={
            me.isError
              ? toUserMessage(me.error)
              : "Your band's board couldn't be found. Try again, or sign out and back in."
          }
          onRetry={() => void me.refetch()}
          showSignOut
        />
      </main>
    );
  }

  // With billing enforced, an unpaid band's routes all answer 402, so the
  // paywall stands in for every page rather than each page failing on its own.
  const current = me.data.boards.find((b) => b.id === me.data?.board?.id);

  return (
    <PermissionsProvider role={me.data.membership.role}>
      <Header me={me.data} />
      <div className="flex flex-1 flex-col">
        {current?.subscriptionRequired ? (
          <SubscriptionPaywall
            boardId={current.id}
            boardName={current.name}
            email={me.data.user.email}
          />
        ) : (
          children
        )}
      </div>
    </PermissionsProvider>
  );
}

function Header({ me }: { me: MeResponse }) {
  const router = useRouter();
  const pathname = usePathname();
  const { role, viewAsUser, setViewAsUser } = usePermissions();
  const initials = me.user.displayName.slice(0, 2).toUpperCase();

  const signOut = async () => {
    await auth.signOut();
    router.replace("/login");
  };

  const onDashboard = pathname === "/dashboard";
  const onCalendar = pathname.startsWith("/calendar");
  const onArchive = pathname.startsWith("/archive");
  const onFinances = pathname.startsWith("/finances");

  return (
    <header className="flex items-center justify-between gap-4 border-b px-6 py-3">
      <div className="flex items-center gap-3">
        <BandSwitcher me={me} />
        {viewAsUser && (
          <Badge variant="secondary" className="rounded-full">
            <Eye data-icon="inline-start" />
            User view
          </Badge>
        )}
      </div>

      <nav className="flex items-center gap-1 rounded-full bg-muted/60 p-1">
        <Button
          variant={onDashboard ? "default" : "ghost"}
          size="sm"
          className="rounded-full"
          nativeButton={false}
          render={<Link href="/dashboard" />}
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
        <Button
          variant={onFinances ? "default" : "ghost"}
          size="sm"
          className="rounded-full"
          nativeButton={false}
          render={<Link href="/finances" />}
        >
          <Wallet data-icon="inline-start" />
          Finances
        </Button>
      </nav>

      <div className="flex items-center gap-4">
        <ThemeToggle />
        {/* An unpaid band's mentions answer 402; its paywall says why. */}
        {me.board &&
          !me.boards.find((b) => b.id === me.board?.id)?.subscriptionRequired && (
            <MentionsIndicator boardId={me.board.id} />
          )}
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
              {/* Everyone needs this now — their own email preferences live
                  there, and the admin-only cards gate themselves. */}
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <Settings data-icon="inline-start" />
                Settings
              </DropdownMenuItem>
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

/**
 * Which band the dashboard shows, and where a new one is started. Shown to
 * everyone, since anyone may create a band; with one band it lists just that
 * one and "Create a band…". Everything on
 * the page is keyed by the band, so switching refetches it all; the one thing
 * that does not carry over is an open item (`?task=…`), which belongs to the
 * band it was opened in, so the switch goes to the dashboard without it.
 */
function BandSwitcher({ me }: { me: MeResponse }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <CreateBandDialog open={creating} onOpenChange={setCreating} />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 px-2" />
          }
          aria-label="Switch band"
        >
          <span className="font-heading text-sm font-semibold tracking-tight">
            {me.board?.name}
          </span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-72">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Your bands</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {me.boards.map((board) => (
              <DropdownMenuItem
                key={board.id}
                onClick={() => {
                  if (board.id === me.board?.id) return;
                  selectBoard(board.id);
                  router.push("/dashboard");
                }}
              >
                {board.id === me.board?.id ? (
                  <Check data-icon="inline-start" />
                ) : (
                  <span className="size-4" aria-hidden />
                )}
                <span className="min-w-0 truncate">{board.name}</span>
                {board.subscriptionRequired && (
                  <Badge variant="outline" className="ml-auto shrink-0">
                    Needs a subscription
                  </Badge>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreating(true)}>
            <Plus data-icon="inline-start" />
            Create a band…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
