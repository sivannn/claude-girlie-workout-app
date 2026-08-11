-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN "contraindications" TEXT;
ALTER TABLE "Exercise" ADD COLUMN "difficultyTier" TEXT;
ALTER TABLE "Exercise" ADD COLUMN "exerciseType" TEXT;
ALTER TABLE "Exercise" ADD COLUMN "muscleGroup" TEXT;

-- AlterTable
ALTER TABLE "UserPreferences" ADD COLUMN "blockCount" INTEGER;
ALTER TABLE "UserPreferences" ADD COLUMN "blockDurationWeeks" INTEGER;
ALTER TABLE "UserPreferences" ADD COLUMN "blockFocusStyle" TEXT;
ALTER TABLE "UserPreferences" ADD COLUMN "deloadPreference" TEXT;
ALTER TABLE "UserPreferences" ADD COLUMN "injuryAreas" TEXT;
ALTER TABLE "UserPreferences" ADD COLUMN "injuryNote" TEXT;
ALTER TABLE "UserPreferences" ADD COLUMN "trainingDaysPerWeek" INTEGER;
