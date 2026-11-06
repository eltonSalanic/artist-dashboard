export interface MentionNotificationDto {
  id: string;
  /**
   * What the row is about. A MENTION opens its task; an APPROVAL (to an admin:
   * a member's expense is waiting) or a DECISION (to the member: approved or
   * sent back) opens the band's Finances.
   */
  kind: "MENTION" | "APPROVAL" | "DECISION";
  /** The task a MENTION lives on; null for the finance kinds. */
  taskId: string | null;
  /** The ledger entry an APPROVAL or DECISION is about; null for a mention. */
  entryId: string | null;
  /**
   * Which board the mention happened on. Needed to open the task — every
   * click-through is board-scoped — and to label the row when the inbox is
   * merged across bands.
   */
  boardId: string;
  boardName: string;
  actorName: string;
  /** The task's title, or the entry's label and amount ("Tire · $50.00"). */
  taskTitle: string;
  excerpt: string;
  createdAt: string;
}
