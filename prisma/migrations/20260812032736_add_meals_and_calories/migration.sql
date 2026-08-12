-- AlterTable
ALTER TABLE "UserPreferences" ADD COLUMN "dailyCalorieTarget" INTEGER;

-- AlterTable
ALTER TABLE "Workout" ADD COLUMN "caloriesBurned" INTEGER;
ALTER TABLE "Workout" ADD COLUMN "caloriesBurnedSource" TEXT;

-- CreateTable
CREATE TABLE "Meal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "calories" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Meal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Meal_userId_date_idx" ON "Meal"("userId", "date");
