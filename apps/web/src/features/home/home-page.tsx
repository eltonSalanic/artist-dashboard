"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMe } from "@/features/auth/use-me";
import { usePermissions } from "@/features/auth/permissions";

export function HomePage() {
  const me = useMe(true);
  const { effectiveRole } = usePermissions();

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>{me.data?.board?.name}</CardTitle>
          <CardDescription>
            Signed in as {me.data?.user.displayName} (
            {effectiveRole === "ADMIN" ? "admin" : "member"}). The widget grid
            arrives in Phase 3.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Admins can invite bandmates from Settings (avatar menu, top right).
        </CardContent>
      </Card>
    </main>
  );
}
