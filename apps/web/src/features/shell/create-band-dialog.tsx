"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateBoard } from "@artist/api-client";
import { selectBoard } from "@/lib/use-me";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * "Create a band": a name, then a new band with you as its admin and the
 * default layout and statuses. Switches to it once it exists.
 */
export function CreateBandDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const create = useCreateBoard();
  const [name, setName] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || create.isPending) return;
    create.mutate(trimmed, {
      onSuccess: (board) => {
        selectBoard(board.id);
        setName("");
        onOpenChange(false);
        router.push("/dashboard");
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Create a band</DialogTitle>
            <DialogDescription>
              You&apos;ll be its admin. Invite your bandmates from Settings
              once it&apos;s set up.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="new-band-name">Band name</FieldLabel>
            <Input
              id="new-band-name"
              autoFocus
              maxLength={80}
              placeholder="The Midnight Owls"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending ? "Creating…" : "Create band"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
