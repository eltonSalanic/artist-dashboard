-- CreateTable
CREATE TABLE "MobileLayout" (
    "id" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "items" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileLayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MobileLayout_boardId_userId_key" ON "MobileLayout"("boardId", "userId");

-- AddForeignKey
ALTER TABLE "MobileLayout" ADD CONSTRAINT "MobileLayout_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileLayout" ADD CONSTRAINT "MobileLayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
