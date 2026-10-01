import type {
  BoardRole,
  BoardSummaryDto,
  BoardTheme,
  LayoutItem,
} from "@artist/shared";

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
  /** Every board the caller belongs to, oldest first. */
  boards: BoardSummaryDto[];
  /**
   * The first membership, kept for the pre-multi-board callers in `apps/web`.
   * New code should read `boards` — these two describe `boards[0]` and nothing
   * more.
   */
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
