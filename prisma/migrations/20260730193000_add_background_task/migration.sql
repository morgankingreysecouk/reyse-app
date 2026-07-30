-- CreateEnum
CREATE TYPE "ra_talk_background_task_status" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "ra_talk_background_task" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" "ra_talk_background_task_status" NOT NULL DEFAULT 'PENDING',
    "sessionId" TEXT,
    "resultSummary" TEXT,
    "error" TEXT,
    "reportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ra_talk_background_task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ra_talk_background_task_status_idx" ON "ra_talk_background_task"("status");

-- CreateIndex
CREATE INDEX "ra_talk_background_task_reportedAt_idx" ON "ra_talk_background_task"("reportedAt");

