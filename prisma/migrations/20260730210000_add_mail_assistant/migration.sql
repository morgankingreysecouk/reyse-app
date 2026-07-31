-- CreateEnum
CREATE TYPE "ra_mail_activity_action" AS ENUM ('MESSAGE_FILED', 'LABEL_CREATED', 'LABEL_RENAMED', 'LABEL_DELETED', 'SYNC_ERROR');

-- CreateTable
CREATE TABLE "ra_mail_account" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "email" TEXT NOT NULL,
    "refreshTokenCiphertext" TEXT NOT NULL,
    "refreshTokenIv" TEXT NOT NULL,
    "refreshTokenAuthTag" TEXT NOT NULL,
    "historyId" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,

    CONSTRAINT "ra_mail_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ra_mail_activity_log" (
    "id" TEXT NOT NULL,
    "action" "ra_mail_activity_action" NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ra_mail_activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ra_mail_activity_log_createdAt_idx" ON "ra_mail_activity_log"("createdAt");

