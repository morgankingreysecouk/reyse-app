-- CreateEnum
CREATE TYPE "ra_chat_role" AS ENUM ('USER', 'ASSISTANT', 'OPERATOR');

-- CreateEnum
CREATE TYPE "ra_chat_conversation_status" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ra_chat_topic" AS ENUM ('PRICING', 'HOW_IT_WORKS', 'GETTING_STARTED', 'OTHER');

-- CreateTable
CREATE TABLE "ra_chat_conversation" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "status" "ra_chat_conversation_status" NOT NULL DEFAULT 'ACTIVE',
    "topic" "ra_chat_topic" NOT NULL DEFAULT 'OTHER',
    "convertedToEnquiry" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ra_chat_conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ra_chat_message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "ra_chat_role" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ra_chat_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ra_chat_knowledge" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "ra_chat_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ra_chat_conversation_status_idx" ON "ra_chat_conversation"("status");

-- CreateIndex
CREATE INDEX "ra_chat_conversation_deletedAt_idx" ON "ra_chat_conversation"("deletedAt");

-- CreateIndex
CREATE INDEX "ra_chat_conversation_lastMessageAt_idx" ON "ra_chat_conversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "ra_chat_conversation_visitorId_idx" ON "ra_chat_conversation"("visitorId");

-- CreateIndex
CREATE INDEX "ra_chat_message_conversationId_idx" ON "ra_chat_message"("conversationId");

-- AddForeignKey
ALTER TABLE "ra_chat_message" ADD CONSTRAINT "ra_chat_message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ra_chat_conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

