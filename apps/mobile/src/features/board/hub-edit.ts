import { useEffect, useRef } from 'react';

/**
 * "Edit widgets" in the board menu, handed to the hub underneath it.
 *
 * The menu is a sheet over the hub, and edit mode is the hub's own state, so
 * the menu raises an event and closes, and the hub, still mounted underneath,
 * hears it. A route param would have meant navigating to the hub again just to
 * say so.
 */
const listeners = new Set<() => void>();

export function requestHubEdit(): void {
  listeners.forEach((listener) => listener());
}

/** Runs `onRequest` whenever the board menu asks the hub to start editing. */
export function useOnHubEditRequest(onRequest: () => void): void {
  const latest = useRef(onRequest);
  useEffect(() => {
    latest.current = onRequest;
  });
  useEffect(() => {
    const listener = () => latest.current();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
}
