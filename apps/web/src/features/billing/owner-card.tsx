"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useBoard,
  useBoardSubscription,
  useDeleteBoard,
  useTransferBoard,
} from "@artist/api-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { selectBoard, useMe } from "@/lib/use-me";

/**
 * The things only a band's owner can do: hand it over, or delete it for good.
 * Not a role, so it isn't in the `can()` map; the API checks the owner too.
 */
export function OwnerCard({ boardId }: { boardId: string }) {
  const subscription = useBoardSubscription(boardId);
  if (!subscription.data?.isOwner) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Band owner</CardTitle>
        <CardDescription>
          You own this band. Only you can hand it over or delete it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <TransferBand boardId={boardId} />
        <DeleteBand boardId={boardId} />
      </CardContent>
    </Card>
  );
}

function TransferBand({ boardId }: { boardId: string }) {
  const me = useMe(true);
  const board = useBoard(boardId);
  const transfer = useTransferBoard(boardId);
  const [userId, setUserId] = useState("");
  const others =
    board.data?.members.filter((m) => m.userId !== me.data?.user.id) ?? [];

  if (others.length === 0) return null;
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (userId) transfer.mutate(userId, { onSuccess: () => setUserId("") });
      }}
    >
      <Field>
        <FieldLabel htmlFor="transfer-band">Hand the band over</FieldLabel>
        <Select
          value={userId}
          onValueChange={(value) => setUserId(value ?? "")}
          items={others.map((m) => ({ value: m.userId, label: m.displayName }))}
        >
          <SelectTrigger id="transfer-band" className="w-full">
            <SelectValue placeholder="Pick a bandmate" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {others.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.displayName}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <p className="text-sm text-muted-foreground">
        They need their own subscription and no band of their own. Their
        subscription keeps the band open from then on, and you stay on as an
        admin.
      </p>
      <Button
        type="submit"
        variant="outline"
        className="self-start"
        disabled={!userId || transfer.isPending}
      >
        Hand it over
      </Button>
    </form>
  );
}

function DeleteBand({ boardId }: { boardId: string }) {
  const router = useRouter();
  const me = useMe(true);
  const board = useBoard(boardId);
  const remove = useDeleteBoard(boardId);
  const [typed, setTyped] = useState("");
  const name = board.data?.name ?? "";
  const matches = !!name && typed.trim() === name.trim();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!matches) return;
        remove.mutate(typed, {
          onSuccess: () => {
            const next = me.data?.boards.find((b) => b.id !== boardId);
            if (next) selectBoard(next.id);
            router.push("/dashboard");
          },
        });
      }}
    >
      <Field>
        <FieldLabel htmlFor="delete-band">Delete this band</FieldLabel>
        <Input
          id="delete-band"
          autoComplete="off"
          placeholder={name}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
      </Field>
      <p className="text-sm text-muted-foreground">
        This wipes the band for everyone, for good: tasks, shows, money, files,
        all of it. Type the band&apos;s name to confirm. You can start a new
        band after.
      </p>
      <Button
        type="submit"
        variant="destructive"
        className="self-start"
        disabled={!matches || remove.isPending}
      >
        Delete band
      </Button>
    </form>
  );
}
