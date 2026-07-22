"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  applyMention,
  findMentionQuery,
  matchMembers,
  type MentionTarget,
} from "./mentions";

/**
 * A textarea with `@`-mention autocomplete. The parent owns the text so it can
 * derive mention ids on submit; this component only manages the caret-driven
 * suggestion popup.
 */
export function CommentComposer({
  value,
  onChange,
  members,
  onSubmit,
  submitLabel = "Comment",
  placeholder = "Write a comment…  @ to mention, **markdown** supported",
  autoFocus,
  busy,
}: {
  value: string;
  onChange: (value: string) => void;
  members: MentionTarget[];
  onSubmit: () => void;
  submitLabel?: string;
  placeholder?: string;
  autoFocus?: boolean;
  busy?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{
    start: number;
    matches: MentionTarget[];
    active: number;
  } | null>(null);

  const refresh = (text: string, caret: number) => {
    const found = findMentionQuery(text, caret);
    if (!found) return setMention(null);
    const matches = matchMembers(members, found.query);
    if (matches.length === 0) return setMention(null);
    setMention({ start: found.start, matches, active: 0 });
  };

  const choose = (target: MentionTarget) => {
    const el = ref.current;
    if (!el || !mention) return;
    const next = applyMention(
      value,
      mention.start,
      el.selectionStart,
      target.displayName,
    );
    onChange(next.text);
    setMention(null);
    // Restore the caret after React re-renders with the new value.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  };

  return (
    <div className="relative flex flex-col gap-2">
      <Textarea
        ref={ref}
        rows={3}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          refresh(e.target.value, e.target.selectionStart);
        }}
        onClick={(e) => refresh(value, e.currentTarget.selectionStart)}
        onKeyDown={(e) => {
          if (mention) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setMention({
                ...mention,
                active: (mention.active + 1) % mention.matches.length,
              });
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setMention({
                ...mention,
                active:
                  (mention.active - 1 + mention.matches.length) %
                  mention.matches.length,
              });
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              choose(mention.matches[mention.active]);
              return;
            }
            if (e.key === "Escape") {
              setMention(null);
              return;
            }
          }
          // Cmd/Ctrl+Enter sends, matching the rest of the app's composers.
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />

      {mention && (
        <ul
          role="listbox"
          className="absolute bottom-full z-20 mb-1 max-h-48 w-56 overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {mention.matches.map((target, index) => (
            <li key={target.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === mention.active}
                className={`w-full rounded px-2 py-1 text-left text-sm ${
                  index === mention.active ? "bg-accent" : ""
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(target);
                }}
              >
                @{target.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end">
        <Button size="sm" disabled={busy || !value.trim()} onClick={onSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
