-- CreateEnum
CREATE TYPE "ra_lead_classification" AS ENUM ('INDEPENDENT', 'PLATFORM', 'IRRELEVANT', 'ERROR');

-- CreateEnum
CREATE TYPE "ra_lead_source" AS ENUM ('PLACES', 'CUSTOM_SEARCH', 'MANUAL');

-- CreateEnum
CREATE TYPE "ra_lead_enrichment_status" AS ENUM ('PENDING', 'COMPLETE', 'PARTIAL', 'NOT_FOUND', 'FAILED');

-- CreateEnum
CREATE TYPE "ra_lead_email_verification" AS ENUM ('UNVERIFIED', 'VALID', 'RISKY', 'INVALID');

-- CreateEnum
CREATE TYPE "ra_lead_instagram_verification" AS ENUM ('UNVERIFIED', 'VALID', 'INVALID');

-- CreateTable
CREATE TABLE "ra_lead_collection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ra_lead_collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ra_lead" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "source" "ra_lead_source" NOT NULL,
    "classification" "ra_lead_classification" NOT NULL,
    "classificationReason" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "instagram" TEXT,
    "linkedin" TEXT,
    "facebook" TEXT,
    "contactName" TEXT,
    "personalisationLine" TEXT,
    "enrichmentStatus" "ra_lead_enrichment_status" NOT NULL DEFAULT 'PENDING',
    "enrichedAt" TIMESTAMP(3),
    "emailVerification" "ra_lead_email_verification" NOT NULL DEFAULT 'UNVERIFIED',
    "emailVerifiedAt" TIMESTAMP(3),
    "instagramVerification" "ra_lead_instagram_verification" NOT NULL DEFAULT 'UNVERIFIED',
    "instagramVerifiedAt" TIMESTAMP(3),
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "excludedReason" TEXT,
    "collectionId" TEXT,
    "exportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ra_lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ra_lead_search_usage" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "placesCalls" INTEGER NOT NULL DEFAULT 0,
    "cseCalls" INTEGER NOT NULL DEFAULT 0,
    "classifyCalls" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ra_lead_search_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ra_lead_domain_key" ON "ra_lead"("domain");

-- CreateIndex
CREATE INDEX "ra_lead_classification_idx" ON "ra_lead"("classification");

-- CreateIndex
CREATE INDEX "ra_lead_excluded_idx" ON "ra_lead"("excluded");

-- CreateIndex
CREATE INDEX "ra_lead_email_idx" ON "ra_lead"("email");

-- CreateIndex
CREATE INDEX "ra_lead_instagram_idx" ON "ra_lead"("instagram");

-- CreateIndex
CREATE INDEX "ra_lead_collectionId_idx" ON "ra_lead"("collectionId");

-- CreateIndex
CREATE INDEX "ra_lead_createdAt_idx" ON "ra_lead"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ra_lead_search_usage_date_key" ON "ra_lead_search_usage"("date");

-- AddForeignKey
ALTER TABLE "ra_lead" ADD CONSTRAINT "ra_lead_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ra_lead_collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

