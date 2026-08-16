-- AlterTable
ALTER TABLE "ra_social_post" ADD COLUMN "reach" INTEGER,
ADD COLUMN "engagement" INTEGER,
ADD COLUMN "metricsFetchedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ra_social_settings" ADD COLUMN "audienceActiveHours" JSONB,
ADD COLUMN "audienceInsightsFetchedAt" TIMESTAMP(3);
