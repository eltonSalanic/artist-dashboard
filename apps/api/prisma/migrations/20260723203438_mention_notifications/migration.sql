-- CreateTable
CREATE TABLE "MentionNotification" (
    "id" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "actorName" TEXT NOT NULL,
    "taskTitle" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentionNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MentionNotification_userId_createdAt_idx" ON "MentionNotification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "MentionNotification" ADD CONSTRAINT "MentionNotification_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentionNotification" ADD CONSTRAINT "MentionNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
