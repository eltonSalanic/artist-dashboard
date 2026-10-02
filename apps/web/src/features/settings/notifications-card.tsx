"use client";

import {
  NOTIFICATION_CATEGORY_COPY,
  NotificationCategories,
} from "@artist/shared";
import {
  useNotificationPreferences,
  useSaveNotificationPreference,
} from "@artist/api-client";
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
  const preferences = useNotificationPreferences(boardId);
  const save = useSaveNotificationPreference(boardId);

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
