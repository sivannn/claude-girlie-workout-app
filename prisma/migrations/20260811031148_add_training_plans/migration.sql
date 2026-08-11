-- CreateTable
CREATE TABLE "TrainingPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "split" TEXT NOT NULL,
    "trainingDaysPerWeek" INTEGER NOT NULL,
    "durationWeeks" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "focus" TEXT NOT NULL,
    "durationWeeks" INTEGER NOT NULL,
    "hasDeloadWeek" BOOLEAN NOT NULL DEFAULT false,
    "setsLow" INTEGER NOT NULL,
    "setsHigh" INTEGER NOT NULL,
    "repRangeLow" INTEGER NOT NULL,
    "repRangeHigh" INTEGER NOT NULL,
    "restSecondsLow" INTEGER NOT NULL,
    "restSecondsHigh" INTEGER NOT NULL,
    CONSTRAINT "PlanBlock_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TrainingPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blockId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "dayOffset" INTEGER NOT NULL,
    "dayLabel" TEXT NOT NULL,
    "muscleGroupsJson" TEXT NOT NULL,
    CONSTRAINT "PlanDay_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "PlanBlock" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanDayExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planDayId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    CONSTRAINT "PlanDayExercise_planDayId_fkey" FOREIGN KEY ("planDayId") REFERENCES "PlanDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanDayExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TrainingPlan_userId_status_idx" ON "TrainingPlan"("userId", "status");

-- CreateIndex
CREATE INDEX "PlanBlock_planId_orderIndex_idx" ON "PlanBlock"("planId", "orderIndex");

-- CreateIndex
CREATE INDEX "PlanDay_blockId_dayIndex_idx" ON "PlanDay"("blockId", "dayIndex");

-- CreateIndex
CREATE INDEX "PlanDayExercise_planDayId_orderIndex_idx" ON "PlanDayExercise"("planDayId", "orderIndex");
