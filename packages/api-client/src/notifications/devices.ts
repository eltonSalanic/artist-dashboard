import type { RegisterDeviceDto } from "@artist/shared";
import { apiFetch } from "../client";

/**
 * A phone's push registration against `/me/devices`.
 *
 * Plain functions rather than mutation hooks: registration happens on app
 * start, on a token rotation, and inside sign-out — none of them is a screen
 * waiting on a result, and nothing is cached that a write would invalidate.
 *
 * Both are idempotent server-side. Registering the same token again touches
 * one row; unregistering a token that is already gone deletes nothing.
 */
export function registerDevice(device: RegisterDeviceDto) {
  return apiFetch<{ registered: true }>("/me/devices", {
    method: "POST",
    body: device,
  });
}

/** Expo tokens look like `ExponentPushToken[…]`, so the brackets need encoding. */
export function unregisterDevice(token: string) {
  return apiFetch<{ unregistered: true }>(
    `/me/devices/${encodeURIComponent(token)}`,
    { method: "DELETE" },
  );
}
