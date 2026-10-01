import type { BoardRole, BoardTheme, LayoutItem } from "@artist/shared";

export interface TaskStatusDto {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isDone: boolean;
}

export interface MeResponse {
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
  };
  membership: { id: string; role: BoardRole } | null;
  board: {
    id: string;
    name: string;
    defaultLayout: LayoutItem[];
    theme: BoardTheme;
  } | null;
}

export interface BoardMemberDto {
  membershipId: string;
  role: BoardRole;
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface BoardDetailDto {
  id: string;
  name: string;
  defaultLayout: LayoutItem[];
  theme: BoardTheme;
  statuses: TaskStatusDto[];
  members: BoardMemberDto[];
}

export interface InviteDto {
  id: string;
  email: string;
  role: BoardRole;
  status: "PENDING" | "ACCEPTED";
  createdAt: string;
}
