export interface AttachmentDto {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  taskId?: string | null;
  commentId?: string | null;
  createdAt: string;
  uploadedBy: { id: string; displayName: string };
}

export interface CommentDto {
  id: string;
  taskId: string;
  /** Plain-text body; `@mentions` are highlighted on render. */
  body: string;
  /** User ids the body mentions. */
  mentions: string[];
  editedAt: string | null;
  createdAt: string;
  author: { id: string; displayName: string; avatarUrl: string | null };
  attachments: AttachmentDto[];
}
