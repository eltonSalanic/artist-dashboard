"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WidgetTypes } from "@artist/shared";

export function HomePage() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Artist Dashboard</CardTitle>
          <CardDescription>
            Scaffolding complete — {WidgetTypes.length} widgets planned. The
            board arrives in the next phases.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          API, database, auth, and storage are running locally via Supabase.
        </CardContent>
      </Card>
    </main>
  );
}
