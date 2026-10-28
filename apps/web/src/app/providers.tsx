"use client";

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { showsInlineError, toUserMessage } from "@artist/api-client";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import { clearCacheOnUserChange } from "@/lib/clear-cache-on-user-change";
import { reportError } from "@/lib/report-error";
import { auth } from "@/lib/auth";

// Side-effect import: configures @artist/api-client before any hook requests.
import "@/lib/api-client-setup";

function makeQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        reportError(error, { queryKey: query.queryKey });
        // Many screens render `data ?? []`, so a failed first load used
        // to look like "nothing here yet". Say it failed instead. A
        // failed background refetch keeps the data already on screen
        // and stays quiet. One shared toast id, so a dead connection
        // doesn't stack a toast per widget.
        if (query.state.data !== undefined) return;
        // Screens with their own error state (detail modals, the dashboard,
        // the app shell) already say it; don't say it twice.
        if (showsInlineError(query.meta)) return;
        toast.error(
          toUserMessage(error, "Couldn't load some of your band's data."),
          {
            id: "query-load-error",
            action: {
              label: "Retry",
              onClick: () => client.refetchQueries({ type: "active" }),
            },
          },
        );
      },
    }),
    // Hooks already toast mutation errors; this only reports bugs.
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) =>
        reportError(error, { mutationKey: mutation.options.mutationKey }),
    }),
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1 },
    },
  });
  return client;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  useEffect(
    () => clearCacheOnUserChange(auth, queryClient),
    [queryClient],
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
