-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ra_enquiry_channel" AS ENUM ('WEBSITE', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'MANUAL');

-- CreateEnum
CREATE TYPE "ra_enquiry_status" AS ENUM ('NEW', 'CONTACTED', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "ra_enquiry" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "message" TEXT,
    "channel" "ra_enquiry_channel" NOT NULL DEFAULT 'WEBSITE',
    "status" "ra_enquiry_status" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "firstRespondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ra_enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ra_enquiry_status_idx" ON "ra_enquiry"("status");

-- CreateIndex
CREATE INDEX "ra_enquiry_channel_idx" ON "ra_enquiry"("channel");

-- CreateIndex
CREATE INDEX "ra_enquiry_deletedAt_idx" ON "ra_enquiry"("deletedAt");

-- CreateIndex
CREATE INDEX "ra_enquiry_createdAt_idx" ON "ra_enquiry"("createdAt");

