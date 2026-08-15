-- Add the two "each side" labeling flags to Exercise. Display-only: they
-- change no stored numbers and no volume math. New columns default false so
-- existing rows (and any custom exercises) are valid immediately; the two
-- backfill UPDATEs then set the seeded library's classification.
--
-- SQLite/libsql both support ADD COLUMN, so this same file is what gets applied
-- by hand to the production Turso database (see the PR description).
ALTER TABLE "Exercise" ADD COLUMN "perSideWeight" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Exercise" ADD COLUMN "perSideReps" BOOLEAN NOT NULL DEFAULT false;

-- Backfill per-side flags for the seeded library (custom exercises stay false).
-- perSideWeight: 39 exercises
UPDATE "Exercise" SET "perSideWeight" = true WHERE "isCustom" = 0 AND "name" IN ('Arnold Press', 'Bulgarian Split Squat', 'Cable Adduction', 'Cable Fly', 'Cable Glute Kickback', 'Cable Lateral Raise', 'Concentration Curl', 'Curtsy Lunge', 'Dumbbell Bench Press', 'Dumbbell Curl', 'Dumbbell Floor Press', 'Dumbbell Romanian Deadlift', 'Dumbbell Row', 'Dumbbell Shoulder Press', 'Dumbbell Shrug', 'Dumbbell Side Bend', 'Farmer''s Carry', 'Flat Dumbbell Fly', 'Front Raise', 'Hammer Curl', 'Incline Dumbbell Curl', 'Incline Dumbbell Fly', 'Incline Dumbbell Press', 'Incline Dumbbell Row', 'Lateral Raise', 'Low-to-High Cable Fly', 'Overhead Dumbbell Carry', 'Rear Delt Fly', 'Renegade Row', 'Reverse Lunge', 'Single-Arm Cable Pulldown', 'Single-Arm Cable Row', 'Spider Curl', 'Standing Cable Abduction', 'Standing Cable Leg Curl', 'Step-Up', 'Suitcase Carry', 'Triceps Kickback', 'Walking Lunge');

-- perSideReps: 44 exercises
UPDATE "Exercise" SET "perSideReps" = true WHERE "isCustom" = 0 AND "name" IN ('B-Stance Hip Thrust', 'Band Low-to-High Chop', 'Banded Glute Kickback', 'Banded Standing Adduction', 'Bicycle Crunch', 'Bird Dog', 'Bulgarian Split Squat', 'Cable Adduction', 'Cable Glute Kickback', 'Cable Lateral Raise', 'Cable Woodchop', 'Clamshell', 'Concentration Curl', 'Copenhagen Plank', 'Cossack Squat', 'Curtsy Lunge', 'Dead Bug', 'Dumbbell Row', 'Dumbbell Side Bend', 'Fire Hydrant', 'Landmine Press', 'Landmine Rotation', 'Lateral Step-Down', 'Lying Windshield Wiper', 'Meadows Row', 'Pallof Press', 'Pistol Squat', 'Renegade Row', 'Reverse Lunge', 'Russian Twist', 'Side Plank', 'Side-Lying Leg Raise', 'Single-Arm Cable Pulldown', 'Single-Arm Cable Row', 'Single-Leg Calf Raise', 'Single-Leg Hip Thrust', 'Single-Leg Romanian Deadlift', 'Single-Leg Squat to Bench', 'Standing Banded Abduction', 'Standing Cable Abduction', 'Standing Cable Leg Curl', 'Step-Up', 'Suitcase Carry', 'Walking Lunge');
