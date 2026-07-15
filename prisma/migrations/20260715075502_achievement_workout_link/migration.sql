-- AlterTable
ALTER TABLE "Achievement" ADD COLUMN "relatedWorkoutId" TEXT;

-- CreateIndex
CREATE INDEX "Achievement_relatedWorkoutId_idx" ON "Achievement"("relatedWorkoutId");
