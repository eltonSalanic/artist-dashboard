"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { BoardRole } from "@artist/shared";
import { useBoard, useInvites, usePermissions, useRevokeInvite, useSendInvite } from "@artist/api-client";
import { useMe } from "@/lib/use-me";
import { AppearanceCard } from "./appearance-card";
import { DefaultLayoutCard } from "./default-layout-card";
import { StatusesCard } from "./statuses-card";
import { ShowStatusesCard } from "./show-statuses-card";
import { NotificationsCard } from "./notifications-card";
import { RemoveMemberDialog } from "./remove-member-dialog";
import { SubscriptionCard } from "@/features/billing/subscription-card";
import { OwnerCard } from "@/features/billing/owner-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

export function SettingsPage() {
  const me = useMe(true);
  const { can } = usePermissions();
  const boardId = me.data?.board?.id;

  if (!boardId) return <Skeleton className="m-6 h-64" />;

  // Notification preferences are personal, so every member gets this page —
  // the admin half of it is what's gated.
  const isAdmin = can("member.invite");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
      <SubscriptionCard
        boardId={boardId}
        userId={me.data?.user.id ?? ""}
        email={me.data?.user.email ?? ""}
      />
      <NotificationsCard boardId={boardId} />
      {isAdmin && (
        <>
          <MembersCard boardId={boardId} />
          <InvitesCard boardId={boardId} />
          <StatusesCard boardId={boardId} />
          <ShowStatusesCard boardId={boardId} />
          {can("board.appearance") && <AppearanceCard boardId={boardId} />}
          <DefaultLayoutCard boardId={boardId} />
        </>
      )}
      <OwnerCard boardId={boardId} />
    </main>
  );
}

function MembersCard({ boardId }: { boardId: string }) {
  const me = useMe(true);
  const board = useBoard(boardId);
  const [removing, setRemoving] = useState<{
    userId: string;
    displayName: string;
  } | null>(null);

  const myUserId = me.data?.user.id;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>Everyone with access to this board.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {board.isPending && <Skeleton className="h-24" />}
        {board.data?.members.map((member) => (
          <div key={member.membershipId} className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback>
                {member.displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm">{member.displayName}</span>
              <span className="truncate text-xs text-muted-foreground">
                {member.email}
              </span>
            </div>
            <Badge variant={member.role === "ADMIN" ? "default" : "secondary"}>
              {member.role === "ADMIN" ? "Admin" : "Member"}
            </Badge>
            {/* Not yourself (that's leaving), and never the owner: the band
                runs on their subscription, so only they can hand it over. */}
            {member.userId !== myUserId &&
              member.userId !== board.data?.ownerId && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${member.displayName} from board`}
                onClick={() =>
                  setRemoving({
                    userId: member.userId,
                    displayName: member.displayName,
                  })
                }
              >
                <Trash2 />
              </Button>
            )}
          </div>
        ))}
      </CardContent>
      <RemoveMemberDialog
        boardId={boardId}
        member={removing}
        onOpenChange={(open) => !open && setRemoving(null)}
      />
    </Card>
  );
}

function InvitesCard({ boardId }: { boardId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<BoardRole>("USER");

  const invites = useInvites(boardId);
  const sendInvite = useSendInvite(boardId);
  const revokeInvite = useRevokeInvite(boardId);

  // The dashboard's "Get set up" card links to /settings#invite. The page is a
  // skeleton until the band loads, so the browser's own jump to the anchor
  // finds nothing: scroll here once the card exists, and start in the field.
  useEffect(() => {
    if (window.location.hash !== "#invite") return;
    document.getElementById("invite")?.scrollIntoView({ block: "start" });
    document.getElementById("invite-email")?.focus({ preventScroll: true });
  }, []);

  return (
    <Card id="invite" className="scroll-mt-6">
      <CardHeader>
        <CardTitle>Invite a member</CardTitle>
        <CardDescription>
          They&apos;ll get an email link to join this board.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendInvite.mutate({ email, role }, { onSuccess: () => setEmail("") });
          }}
        >
          <FieldGroup>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <Field className="flex-1">
                <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                <Input
                  id="invite-email"
                  type="email"
                  required
                  placeholder="bandmate@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field className="sm:w-36">
                <FieldLabel htmlFor="invite-role">Role</FieldLabel>
                <Select
                  value={role}
                  onValueChange={(v) => setRole(v as BoardRole)}
                >
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="USER">Member</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Button type="submit" disabled={sendInvite.isPending}>
                {sendInvite.isPending && <Spinner data-icon="inline-start" />}
                Send invite
              </Button>
            </div>
          </FieldGroup>
        </form>

        {invites.data && invites.data.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Pending invites
            </span>
            {invites.data.map((invite) => (
              <div key={invite.id} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {invite.email}
                </span>
                <Badge variant="secondary">
                  {invite.role === "ADMIN" ? "Admin" : "Member"}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Revoke invite for ${invite.email}`}
                  onClick={() => revokeInvite.mutate(invite.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
