"use client";

import { useRouter, useSearchParams } from "next/navigation";

/** Detail modals are driven by search params so they stay linkable. */
export type DetailParam = "task" | "goal" | "event" | "reminder";

export function useDetailParams() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const open = (param: DetailParam, id: string) => {
    const params = new URLSearchParams(searchParams);
    params.set(param, id);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const close = (param: DetailParam) => {
    const params = new URLSearchParams(searchParams);
    params.delete(param);
    router.push(params.size ? `?${params.toString()}` : "?", { scroll: false });
  };

  /** Closes one detail modal and opens another, so they never stack. */
  const swap = (from: DetailParam, to: DetailParam, id: string) => {
    const params = new URLSearchParams(searchParams);
    params.delete(from);
    params.set(to, id);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  return {
    open,
    close,
    swap,
    get: (param: DetailParam) => searchParams.get(param),
  };
}
