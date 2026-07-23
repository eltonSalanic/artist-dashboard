"use client";

import { useRouter } from "next/navigation";
import { AtSign, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { relativeTime } from "@/features/comments/comment-bits";
import {
  useClearMentions,
  useDismissMention,
  useMentions,
} from "./use-mentions";

/**
 * A "you were mentioned" bell that only appears once you actually have an
 * unseen mention. Opening it lists every place you were mentioned; each can be
 * opened (which dismisses it) or removed outright.
 */
export function MentionsIndicator({ boardId }: { boardId: string }) {
  const router = useRouter();
  const mentions = useMentions(boardId);
  const dismiss = useDismissMention(boardId);
  const clearAll = useClearMentions(boardId);

  const items = mentions.data ?? [];
  // The indicator only "comes up" once there's something to show.
  if (items.length === 0) return null;

  const open = (taskId: string, id: string) => {
    dismiss.mutate(id);
    router.push(`/?task=${taskId}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`${items.length} new mention${items.length > 1 ? "s" : ""}`}
            className="relative rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          />
        }
      >
        <AtSign className="size-5" />
        <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
          {items.length > 9 ? "9+" : items.length}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Mentions</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-1 py-0.5 text-xs"
            onClick={() => clearAll.mutate()}
            disabled={clearAll.isPending}
          >
            Clear all
          </Button>
        </div>
        <ul className="max-h-96 overflow-y-auto py-1">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-2 px-3 py-2 hover:bg-accent/50"
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => open(item.taskId, item.id)}
              >
                <p className="text-sm">
                  <span className="font-medium">{item.actorName}</span> mentioned
                  you in <span className="font-medium">{item.taskTitle}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.excerpt}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {relativeTime(item.createdAt)}
                </p>
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Dismiss mention"
                onClick={() => dismiss.mutate(item.id)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
