"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { BoardRole } from "@artist/shared";
import { apiFetch, ApiError } from "@/lib/api";
import { useMe } from "@/features/auth/use-me";
import { usePermissions } from "@/features/auth/permissions";
import type { BoardDetailDto, InviteDto } from "@/features/auth/types";
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

  if (!can("member.invite")) {
    return (
      <main className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Only board admins can manage settings.
      </main>
    );
  }

  if (!boardId) return <Skeleton className="m-6 h-64" />;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-lg font-semibold tracking-tight">Board settings</h1>
      <MembersCard boardId={boardId} />
      <InvitesCard boardId={boardId} />
    </main>
  );
}

function MembersCard({ boardId }: { boardId: string }) {
  const board = useQuery({
    queryKey: ["board", boardId],
    queryFn: () => apiFetch<BoardDetailDto>(`/boards/${boardId}`),
  });

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
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function InvitesCard({ boardId }: { boardId: string }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<BoardRole>("USER");

  const invites = useQuery({
    queryKey: ["invites", boardId],
    queryFn: () => apiFetch<InviteDto[]>(`/boards/${boardId}/invites`),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["invites", boardId] });

  const sendInvite = useMutation({
    mutationFn: () =>
      apiFetch<InviteDto & { delivery: string }>(`/boards/${boardId}/invites`, {
        method: "POST",
        body: { email, role },
      }),
    onSuccess: (invite) => {
      setEmail("");
      invalidate();
      toast.success(
        invite.delivery === "already_registered"
          ? "Invite saved — they'll join next time they sign in"
          : "Invite email sent",
      );
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Invite failed"),
  });

  const revokeInvite = useMutation({
    mutationFn: (inviteId: string) =>
      apiFetch(`/boards/${boardId}/invites/${inviteId}`, { method: "DELETE" }),
    onSuccess: () => invalidate(),
  });

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
            sendInvite.mutate();
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
