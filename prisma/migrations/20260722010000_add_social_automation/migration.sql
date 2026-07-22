-- CreateEnum
CREATE TYPE "ra_social_platform" AS ENUM ('INSTAGRAM', 'FACEBOOK');

-- CreateEnum
CREATE TYPE "ra_social_post_type" AS ENUM ('SINGLE', 'CAROUSEL');

-- CreateEnum
CREATE TYPE "ra_social_post_status" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ra_social_pillar" AS ENUM ('PROMOTION', 'EDUCATION', 'SOCIAL_PROOF', 'BEHIND_THE_SCENES', 'NEWS', 'TIPS');

-- CreateEnum
CREATE TYPE "ra_social_image_source" AS ENUM ('AI_PHOTO', 'TEMPLATE');

-- CreateEnum
CREATE TYPE "ra_social_publishing_mode" AS ENUM ('REVIEW_QUEUE', 'AUTONOMOUS');

-- CreateTable
CREATE TABLE "ra_social_post" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "platform" "ra_social_platform" NOT NULL,
    "type" "ra_social_post_type" NOT NULL,
    "pillar" "ra_social_pillar" NOT NULL,
    "status" "ra_social_post_status" NOT NULL DEFAULT 'DRAFT',
    "caption" TEXT NOT NULL,
    "hashtags" TEXT[],
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "externalPostId" TEXT,
    "externalPermalink" TEXT,
    "failureReason" TEXT,
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ra_social_post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ra_social_post_image" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "assetId" TEXT NOT NULL,
    "altText" TEXT NOT NULL,
    "source" "ra_social_image_source" NOT NULL,

    CONSTRAINT "ra_social_post_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ra_social_asset" (
    "id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ra_social_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ra_social_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "publishingMode" "ra_social_publishing_mode" NOT NULL DEFAULT 'REVIEW_QUEUE',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "postsPerWeekInstagram" INTEGER NOT NULL DEFAULT 3,
    "postsPerWeekFacebook" INTEGER NOT NULL DEFAULT 3,
    "lastGeneratedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ra_social_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ra_ai_usage_log" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "imageCount" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ra_ai_usage_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ra_social_post_status_idx" ON "ra_social_post"("status");

-- CreateIndex
CREATE INDEX "ra_social_post_groupId_idx" ON "ra_social_post"("groupId");

-- CreateIndex
CREATE INDEX "ra_social_post_deletedAt_idx" ON "ra_social_post"("deletedAt");

-- CreateIndex
CREATE INDEX "ra_social_post_scheduledFor_idx" ON "ra_social_post"("scheduledFor");

-- CreateIndex
CREATE INDEX "ra_social_post_platform_idx" ON "ra_social_post"("platform");

-- CreateIndex
CREATE INDEX "ra_social_post_image_postId_idx" ON "ra_social_post_image"("postId");

-- CreateIndex
CREATE INDEX "ra_ai_usage_log_feature_createdAt_idx" ON "ra_ai_usage_log"("feature", "createdAt");

-- CreateIndex
CREATE INDEX "ra_ai_usage_log_createdAt_idx" ON "ra_ai_usage_log"("createdAt");

-- AddForeignKey
ALTER TABLE "ra_social_post_image" ADD CONSTRAINT "ra_social_post_image_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ra_social_post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_social_post_image" ADD CONSTRAINT "ra_social_post_image_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "ra_social_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

