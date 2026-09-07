"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  NOTIFICATION_CATEGORY_COPY,
  NotificationCategories,
  type NotificationCategory,
  type NotificationPreferencesDto,
} from "@artist/shared";
import { apiFetch, ApiError } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

/**
 * Personal, not administrative — these are *your* emails for this board, so
 * this card is the one part of settings every member sees.
 */
export function NotificationsCard({ boardId }: { boardId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["notification-preferences", boardId];

  const preferences = useQuery({
    queryKey,
    queryFn: () =>
      apiFetch<NotificationPreferencesDto>(
        `/boards/${boardId}/notification-preferences`,
      ),
  });

  const save = useMutation({
    mutationFn: (input: { category: NotificationCategory; enabled: boolean }) =>
      apiFetch<NotificationPreferencesDto>(
        `/boards/${boardId}/notification-preferences`,
        { method: "PUT", body: input },
      ),
    // A toggle that lags behind the thumb feels broken, so paint it first and
    // put it back if the save fails.
    onMutate: ({ category, enabled }) => {
      const previous =
        queryClient.getQueryData<NotificationPreferencesDto>(queryKey);
      queryClient.setQueryData<NotificationPreferencesDto>(
        queryKey,
        (current) => current && { ...current, [category]: enabled },
      );
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous)
        queryClient.setQueryData(queryKey, context.previous);
      toast.error(
        error instanceof ApiError ? error.message : "Couldn't save that",
      );
    },
    onSuccess: (fresh) => queryClient.setQueryData(queryKey, fresh),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email notifications</CardTitle>
        <CardDescription>
          What this board is allowed to email you about. Everything else stays
          in the activity feed.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {preferences.isPending && <Skeleton className="h-40" />}
        {preferences.data &&
          NotificationCategories.map((category) => {
            const copy = NOTIFICATION_CATEGORY_COPY[category];
            const id = `notify-${category.toLowerCase()}`;
            return (
              <div key={category} className="flex items-start gap-4">
                <div className="flex min-w-0 flex-1 flex-col">
                  <Label htmlFor={id}>{copy.label}</Label>
                  <span className="text-xs text-muted-foreground">
                    {copy.description}
                  </span>
                </div>
                <Switch
                  id={id}
                  checked={preferences.data[category]}
                  onCheckedChange={(enabled) =>
                    save.mutate({ category, enabled })
                  }
                />
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}
