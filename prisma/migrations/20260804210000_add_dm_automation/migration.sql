
-- CreateEnum
CREATE TYPE "ra_client_status" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ra_client_meta_connection_status" AS ENUM ('ACTIVE', 'NEEDS_REAUTH', 'ERROR');

-- CreateEnum
CREATE TYPE "ra_dm_conversation_status" AS ENUM ('AI_ACTIVE', 'ESCALATED', 'HUMAN_ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ra_dm_message_role" AS ENUM ('GUEST', 'AI', 'OPERATOR');

-- CreateEnum
CREATE TYPE "ra_dm_activity_action" AS ENUM ('ESCALATED', 'TAKEN_OVER_BY_OPERATOR', 'RETURNED_TO_AI', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'TOKEN_REAUTH_NEEDED', 'WEBHOOK_HEALTH_CHECK_FAILED');

-- CreateEnum
CREATE TYPE "ra_calendar_source" AS ENUM ('ICAL', 'GOOGLE');

-- CreateEnum
CREATE TYPE "ra_calendar_connection_status" AS ENUM ('ACTIVE', 'ERROR');

-- CreateEnum
CREATE TYPE "ra_calendar_block_source" AS ENUM ('ICAL_IMPORT', 'GOOGLE_IMPORT', 'REYSE_BOOKING');

-- CreateEnum
CREATE TYPE "ra_booking_status" AS ENUM ('CONFIRMED', 'CANCELLED');

-- AlterTable
ALTER TABLE "ra_ai_usage_log" ADD COLUMN     "clientId" TEXT;

-- CreateTable
CREATE TABLE "ra_client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "ra_client_status" NOT NULL DEFAULT 'ACTIVE',
    "notificationEmail" TEXT NOT NULL,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ra_client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ra_property" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "checkInTime" TEXT,
    "checkOutTime" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ra_property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ra_property_knowledge_base" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "ra_property_knowledge_base_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ra_client_meta_connection" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "platform" "ra_social_platform" NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "externalUsername" TEXT,
    "pageId" TEXT,
    "accessTokenCiphertext" TEXT NOT NULL,
    "accessTokenIv" TEXT NOT NULL,
    "accessTokenAuthTag" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "status" "ra_client_meta_connection_status" NOT NULL DEFAULT 'ACTIVE',
    "lastHealthCheckAt" TIMESTAMP(3),
    "lastHealthCheckError" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ra_client_meta_connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ra_dm_conversation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "propertyId" TEXT,
    "platform" "ra_social_platform" NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "externalUsername" TEXT,
    "status" "ra_dm_conversation_status" NOT NULL DEFAULT 'AI_ACTIVE',
    "escalatedAt" TIMESTAMP(3),
    "escalationReason" TEXT,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ra_dm_conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ra_dm_message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "ra_dm_message_role" NOT NULL,
    "content" TEXT NOT NULL,
    "externalMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ra_dm_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ra_dm_activity_log" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "conversationId" TEXT,
    "action" "ra_dm_activity_action" NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ra_dm_activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ra_calendar_connection" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "source" "ra_calendar_source" NOT NULL,
    "icalUrl" TEXT,
    "googleCalendarId" TEXT,
    "googleRefreshTokenCiphertext" TEXT,
    "googleRefreshTokenIv" TEXT,
    "googleRefreshTokenAuthTag" TEXT,
    "status" "ra_calendar_connection_status" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ra_calendar_connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ra_calendar_block" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "source" "ra_calendar_block_source" NOT NULL,
    "externalUid" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ra_calendar_block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ra_booking" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "conversationId" TEXT,
    "guestName" TEXT NOT NULL,
    "guestContact" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "ra_booking_status" NOT NULL DEFAULT 'CONFIRMED',
    "notes" TEXT,
    "notifiedHostAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ra_booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ra_dm_webhook_health_check_log" (
    "id" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ok" BOOLEAN NOT NULL,
    "statusCode" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ra_dm_webhook_health_check_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ra_client_slug_key" ON "ra_client"("slug");

-- CreateIndex
CREATE INDEX "ra_client_status_idx" ON "ra_client"("status");

-- CreateIndex
CREATE INDEX "ra_client_deletedAt_idx" ON "ra_client"("deletedAt");

-- CreateIndex
CREATE INDEX "ra_property_clientId_idx" ON "ra_property"("clientId");

-- CreateIndex
CREATE INDEX "ra_property_deletedAt_idx" ON "ra_property"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ra_property_knowledge_base_propertyId_key" ON "ra_property_knowledge_base"("propertyId");

-- CreateIndex
CREATE INDEX "ra_client_meta_connection_status_idx" ON "ra_client_meta_connection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ra_client_meta_connection_clientId_platform_key" ON "ra_client_meta_connection"("clientId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "ra_client_meta_connection_platform_externalAccountId_key" ON "ra_client_meta_connection"("platform", "externalAccountId");

-- CreateIndex
CREATE INDEX "ra_dm_conversation_clientId_status_idx" ON "ra_dm_conversation"("clientId", "status");

-- CreateIndex
CREATE INDEX "ra_dm_conversation_deletedAt_idx" ON "ra_dm_conversation"("deletedAt");

-- CreateIndex
CREATE INDEX "ra_dm_conversation_lastInboundAt_idx" ON "ra_dm_conversation"("lastInboundAt");

-- CreateIndex
CREATE UNIQUE INDEX "ra_dm_conversation_clientId_platform_externalUserId_key" ON "ra_dm_conversation"("clientId", "platform", "externalUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ra_dm_message_externalMessageId_key" ON "ra_dm_message"("externalMessageId");

-- CreateIndex
CREATE INDEX "ra_dm_message_conversationId_createdAt_idx" ON "ra_dm_message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ra_dm_activity_log_clientId_createdAt_idx" ON "ra_dm_activity_log"("clientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ra_calendar_connection_propertyId_key" ON "ra_calendar_connection"("propertyId");

-- CreateIndex
CREATE INDEX "ra_calendar_block_propertyId_startDate_endDate_idx" ON "ra_calendar_block"("propertyId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "ra_calendar_block_propertyId_externalUid_key" ON "ra_calendar_block"("propertyId", "externalUid");

-- CreateIndex
CREATE INDEX "ra_booking_propertyId_startDate_endDate_idx" ON "ra_booking"("propertyId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "ra_booking_conversationId_idx" ON "ra_booking"("conversationId");

-- CreateIndex
CREATE INDEX "ra_booking_deletedAt_idx" ON "ra_booking"("deletedAt");

-- CreateIndex
CREATE INDEX "ra_dm_webhook_health_check_log_ranAt_idx" ON "ra_dm_webhook_health_check_log"("ranAt");

-- CreateIndex
CREATE INDEX "ra_ai_usage_log_clientId_createdAt_idx" ON "ra_ai_usage_log"("clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "ra_ai_usage_log" ADD CONSTRAINT "ra_ai_usage_log_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ra_client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_property" ADD CONSTRAINT "ra_property_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ra_client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_property_knowledge_base" ADD CONSTRAINT "ra_property_knowledge_base_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "ra_property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_client_meta_connection" ADD CONSTRAINT "ra_client_meta_connection_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ra_client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_dm_conversation" ADD CONSTRAINT "ra_dm_conversation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ra_client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_dm_conversation" ADD CONSTRAINT "ra_dm_conversation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "ra_property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_dm_message" ADD CONSTRAINT "ra_dm_message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ra_dm_conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_dm_activity_log" ADD CONSTRAINT "ra_dm_activity_log_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ra_client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_dm_activity_log" ADD CONSTRAINT "ra_dm_activity_log_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ra_dm_conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_calendar_connection" ADD CONSTRAINT "ra_calendar_connection_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "ra_property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_calendar_block" ADD CONSTRAINT "ra_calendar_block_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "ra_property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_calendar_block" ADD CONSTRAINT "ra_calendar_block_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "ra_booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_booking" ADD CONSTRAINT "ra_booking_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "ra_property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ra_booking" ADD CONSTRAINT "ra_booking_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ra_dm_conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

