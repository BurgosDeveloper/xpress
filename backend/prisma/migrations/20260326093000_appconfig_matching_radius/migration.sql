-- Add global matching radius to app config.
ALTER TABLE "AppConfig"
ADD COLUMN "matchingRadiusM" INTEGER NOT NULL DEFAULT 2000;