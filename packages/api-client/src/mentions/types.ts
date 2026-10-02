export interface MentionNotificationDto {
  id: string;
  taskId: string;
  /**
   * Which board the mention happened on. Needed to open the task — every
   * click-through is board-scoped — and to label the row when the inbox is
   * merged across bands.
   */
  boardId: string;
  boardName: string;
  actorName: string;
  taskTitle: string;
  excerpt: string;
  createdAt: string;
}
