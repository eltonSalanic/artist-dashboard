-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "thumbnailPath" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_thumbnailPath_key" ON "Attachment"("thumbnailPath");
