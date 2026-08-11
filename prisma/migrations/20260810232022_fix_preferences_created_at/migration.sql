-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserPreferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "weeklyLegDayTarget" INTEGER NOT NULL DEFAULT 1,
    "weeklyUpperBodyTarget" INTEGER NOT NULL DEFAULT 1,
    "weeklyCardioTarget" INTEGER NOT NULL DEFAULT 1,
    "weeklyFunTarget" INTEGER NOT NULL DEFAULT 1,
    "monthlyWorkoutTarget" INTEGER NOT NULL DEFAULT 18,
    "unitSystem" TEXT NOT NULL DEFAULT 'imperial',
    "topPriorityCategory" TEXT,
    "onboardingCompletedAt" DATETIME,
    "experienceLevel" TEXT,
    "bodyWeightLb" REAL,
    "primaryGoal" TEXT,
    "musclePriorities" TEXT,
    "workoutPreferences" TEXT,
    "equipmentAccess" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserPreferences" ("bodyWeightLb", "createdAt", "equipmentAccess", "experienceLevel", "id", "monthlyWorkoutTarget", "musclePriorities", "onboardingCompletedAt", "primaryGoal", "topPriorityCategory", "unitSystem", "updatedAt", "userId", "weeklyCardioTarget", "weeklyFunTarget", "weeklyLegDayTarget", "weeklyUpperBodyTarget", "workoutPreferences") SELECT "bodyWeightLb", "createdAt", "equipmentAccess", "experienceLevel", "id", "monthlyWorkoutTarget", "musclePriorities", "onboardingCompletedAt", "primaryGoal", "topPriorityCategory", "unitSystem", "updatedAt", "userId", "weeklyCardioTarget", "weeklyFunTarget", "weeklyLegDayTarget", "weeklyUpperBodyTarget", "workoutPreferences" FROM "UserPreferences";
DROP TABLE "UserPreferences";
ALTER TABLE "new_UserPreferences" RENAME TO "UserPreferences";
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
