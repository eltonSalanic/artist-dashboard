"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { MeResponse } from "./types";

/**
 * Bootstrap is idempotent on the API: it upserts the user, activates any
 * pending invites for the verified email, and creates a board on first login.
 */
export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/me/bootstrap", { method: "POST" }),
    enabled,
    staleTime: Infinity,
  });
}
