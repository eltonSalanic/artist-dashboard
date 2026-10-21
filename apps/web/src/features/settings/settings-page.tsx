"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { BoardRole } from "@artist/shared";
import { useBoard, useInvites, usePermissions, useRemoveMember, useRevokeInvite, useSendInvite } from "@artist/api-client";
import { useMe } from "@/lib/use-me";
import { AppearanceCard } from "./appearance-card";
import { DefaultLayoutCard } from "./default-layout-card";
import { StatusesCard } from "./statuses-card";
import { NotificationsCard } from "./notifications-card";
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
      <NotificationsCard boardId={boardId} />
      {isAdmin && (
        <>
          <MembersCard boardId={boardId} />
          <InvitesCard boardId={boardId} />
          <StatusesCard boardId={boardId} />
          {can("board.appearance") && <AppearanceCard boardId={boardId} />}
          <DefaultLayoutCard boardId={boardId} />
        </>
      )}
    </main>
  );
}

function MembersCard({ boardId }: { boardId: string }) {
  const me = useMe(true);
  const board = useBoard(boardId);
  const removeMember = useRemoveMember(boardId);

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
            {member.userId !== myUserId && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${member.displayName} from board`}
                disabled={removeMember.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Remove ${member.displayName} from this board? They'll lose access and be unassigned from all tasks.`,
                    )
                  ) {
                    removeMember.mutate(member.userId);
                  }
                }}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function InvitesCard({ boardId }: { boardId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<BoardRole>("USER");

  const invites = useInvites(boardId);
  const sendInvite = useSendInvite(boardId);
  const revokeInvite = useRevokeInvite(boardId);

  return (
    <Card>
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
