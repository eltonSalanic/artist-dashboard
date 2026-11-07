export interface MentionNotificationDto {
  id: string;
  /**
   * What the row is about. A MENTION opens its task; a PAYBACK (to an admin:
   * a member paid out of pocket and is owed) or a PAID_BACK (to the member:
   * the band paid them back) opens the band's Finances.
   */
  kind: "MENTION" | "PAYBACK" | "PAID_BACK";
  /** The task a MENTION lives on; null for the finance kinds. */
  taskId: string | null;
  /**
   * The ledger entry a PAYBACK or PAID_BACK is about; null for a mention, or
   * for one payback that covered several entries.
   */
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
