"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import { clearCacheOnUserChange } from "@/lib/clear-cache-on-user-change";
import { supabase } from "@/lib/supabase";

// Side-effect import: configures @artist/api-client before any hook requests.
import "@/lib/api-client-setup";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
        },
      }),
  );

  useEffect(
    () => clearCacheOnUserChange(supabase.auth, queryClient),
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
