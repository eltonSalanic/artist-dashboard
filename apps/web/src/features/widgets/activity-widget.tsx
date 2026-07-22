"use client";

import { Activity } from "lucide-react";
import { useDetailParams } from "@/features/planning/use-detail-params";
import { relativeTime } from "@/features/comments/comment-bits";
import { useActivityFeed } from "@/features/activity/use-activity";
import { activityTaskId, renderActivity } from "@/features/activity/activity-bits";
import type { ActivityItemDto } from "@/features/activity/types";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export function ActivityWidget({ boardId }: { boardId: string }) {
  const feed = useActivityFeed(boardId, 12);

  if (feed.isPending) return <Skeleton className="h-full min-h-24" />;

  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  if (items.length === 0) return <ActivityEmpty />;

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <ActivityRow key={item.id} item={item} />
      ))}
    </ul>
  );
}

export function ActivityWidgetExpanded({ boardId }: { boardId: string }) {
  const feed = useActivityFeed(boardId);

  if (feed.isPending) return <Skeleton className="h-40" />;

  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  if (items.length === 0) return <ActivityEmpty />;

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <ActivityRow key={item.id} item={item} />
        ))}
      </ul>
      {feed.hasNextPage && (
        <Button
          variant="outline"
          size="sm"
          className="self-center"
          disabled={feed.isFetchingNextPage}
          onClick={() => feed.fetchNextPage()}
        >
          {feed.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItemDto }) {
  const { open } = useDetailParams();
  const { icon: Icon, text } = renderActivity(item);
  const taskId = activityTaskId(item);
  const actorName = item.actor?.displayName ?? "Someone";

  const body = (
    <div className="flex min-w-0 flex-1 items-start gap-2">
      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <span className="font-medium">{actorName}</span> {text}
        </p>
        <span className="text-xs text-muted-foreground">
          {relativeTime(item.createdAt)}
        </span>
      </div>
    </div>
  );

  return (
    <li>
      {taskId ? (
        <button
          type="button"
          className="w-full rounded-md p-1 text-left hover:bg-accent/50"
          onClick={() => open("task", taskId)}
        >
          {body}
        </button>
      ) : (
        <div className="p-1">{body}</div>
      )}
    </li>
  );
}

function ActivityEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Activity />
        </EmptyMedia>
        <EmptyTitle>No activity yet</EmptyTitle>
        <EmptyDescription>
          Task changes, comments, and uploads show up here.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
