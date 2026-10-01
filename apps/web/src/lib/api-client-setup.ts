import { toast } from "sonner";
import { configureApiClient } from "@artist/api-client";
import { supabase } from "./supabase";

/**
 * Web's half of the `@artist/api-client` contract. The package deliberately
 * knows nothing about Next.js env vars, the browser Supabase client, or sonner
 * — mobile supplies an `expo-secure-store` client, an `expo-constants` URL and
 * its own toast instead.
 *
 * Imported for its side effect by the app shell, so it runs before any hook
 * fires a request.
 */
configureApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
  getAccessToken: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  },
  notify: {
    error: (message) => toast.error(message),
    success: (message) => toast.success(message),
  },
});
