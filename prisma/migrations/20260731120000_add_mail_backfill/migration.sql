-- CreateEnum
CREATE TYPE "ra_mail_backfill_status" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE');

-- AlterEnum
ALTER TYPE "ra_mail_activity_action" ADD VALUE 'MESSAGE_MOVED';

-- AlterTable
ALTER TABLE "ra_mail_account" ADD COLUMN     "backfillPageToken" TEXT,
ADD COLUMN     "backfillStatus" "ra_mail_backfill_status" NOT NULL DEFAULT 'NOT_STARTED';

