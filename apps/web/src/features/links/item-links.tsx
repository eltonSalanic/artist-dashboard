"use client";

import { useId, useRef, useState } from "react";
import { ExternalLink, Link2, Trash2 } from "lucide-react";
import { itemLinkInputSchema, type LinkParentKind } from "@artist/shared";
import {
  ApiError,
  useItemLinks,
  useMe,
  usePermissions,
} from "@artist/api-client";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { labelStyle } from "@/lib/label-style";

export function ItemLinks({
  boardId,
  kind,
  parentId,
}: {
  boardId: string;
  kind: LinkParentKind;
  parentId: string;
}) {
  const links = useItemLinks(boardId, kind, parentId);
  const { can } = usePermissions();
  const me = useMe(true);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const urlInput = useRef<HTMLInputElement>(null);
  const id = useId();

  const save = async () => {
    if (links.add.isPending) return;
    const parsed = itemLinkInputSchema.safeParse({ title, url });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      urlInput.current?.focus();
      return;
    }
    setError("");
    try {
      await links.add.mutateAsync(parsed.data);
      setAdding(false);
      setTitle("");
      setUrl("");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not save the link. Try again.",
      );
    }
  };

  return (
    <section className="flex flex-col gap-3" aria-label="Links">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={labelStyle}>Links</h3>
        {can("link.add") && !adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Link2 data-icon="inline-start" />
            Add a link
          </Button>
        )}
      </div>
      {links.isPending ? <Skeleton className="h-12 w-full" /> : null}
      {links.isError && (
        <div className="flex flex-wrap items-center gap-2" role="alert">
          <p className="text-sm text-destructive">Could not load links.</p>
          <Button
            variant="ghost"
            size="sm"
            disabled={links.isFetching}
            onClick={() => void links.refetch()}
          >
            Try again
          </Button>
        </div>
      )}
      {links.data?.map((link) => (
        <div
          key={link.id}
          className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/50 p-3"
        >
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            aria-label={`${link.title} (opens in a new tab)`}
          >
            <Link2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="break-words font-medium">{link.title}</span>
              <span className="truncate text-xs text-muted-foreground">
                {link.url}
              </span>
            </span>
            <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
          </a>
          {(link.createdById === me.data?.user.id || can("link.manage")) && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove link ${link.title}`}
              disabled={links.remove.isPending}
              onClick={() => {
                if (window.confirm(`Remove the link “${link.title}”?`))
                  links.remove.mutate(link.id);
              }}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      ))}
      {links.isSuccess && links.data.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">
          Attach a shared drive, spreadsheet, or any web link.
        </p>
      )}
      {adding && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-title`}>Name (optional)</FieldLabel>
              <Input
                id={`${id}-title`}
                autoFocus
                maxLength={200}
                placeholder="Link name"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={links.add.isPending}
              />
            </Field>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor={`${id}-url`}>
                URL{" "}
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
              </FieldLabel>
              <Input
                id={`${id}-url`}
                ref={urlInput}
                inputMode="url"
                autoComplete="url"
                autoCapitalize="none"
                spellCheck={false}
                aria-required="true"
                aria-invalid={!!error}
                aria-describedby={error ? `${id}-error` : undefined}
                maxLength={2048}
                placeholder="Link"
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                  setError("");
                }}
                disabled={links.add.isPending}
              />
              {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={links.add.isPending}>
                {links.add.isPending ? "Saving…" : "Save link"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={links.add.isPending}
                onClick={() => {
                  setAdding(false);
                  setTitle("");
                  setUrl("");
                  setError("");
                }}
              >
                Cancel
              </Button>
            </div>
          </FieldGroup>
        </form>
      )}
    </section>
  );
}
