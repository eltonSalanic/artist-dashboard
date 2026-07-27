import { useState } from "react";

/**
 * react-grid-layout suppresses text selection while an item is being *dragged*,
 * but not while it's being *resized* — so pulling a resize handle drag-selects
 * the card's text. This tracks the resize gesture (via the grid's
 * `onResizeStart`/`onResizeStop`) so the caller can apply `select-none` to the
 * grid container for its duration, and only then.
 */
export function useGridResizeGuard() {
  const [resizing, setResizing] = useState(false);
  return {
    resizing,
    onResizeStart: () => setResizing(true),
    onResizeStop: () => setResizing(false),
  };
}
