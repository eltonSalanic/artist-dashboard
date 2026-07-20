"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { can, type Action, type BoardRole } from "@artist/shared";

interface PermissionsContextValue {
  /** The member's real role on the board. */
  role: BoardRole;
  /** Role used for UI decisions — 'USER' while an admin previews User View. */
  effectiveRole: BoardRole;
  viewAsUser: boolean;
  setViewAsUser: (value: boolean) => void;
  can: (action: Action) => boolean;
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export function PermissionsProvider({
  role,
  children,
}: {
  role: BoardRole;
  children: React.ReactNode;
}) {
  const [viewAsUser, setViewAsUser] = useState(false);

  const value = useMemo<PermissionsContextValue>(() => {
    const effectiveRole: BoardRole =
      role === "ADMIN" && viewAsUser ? "USER" : role;
    return {
      role,
      effectiveRole,
      viewAsUser,
      setViewAsUser,
      can: (action) => can(effectiveRole, action),
    };
  }, [role, viewAsUser]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext);
  if (!ctx) {
    throw new Error("usePermissions must be used inside PermissionsProvider");
  }
  return ctx;
}
