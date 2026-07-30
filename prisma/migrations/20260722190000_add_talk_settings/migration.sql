-- CreateTable
CREATE TABLE "ra_talk_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "voice" TEXT NOT NULL DEFAULT 'bm_lewis',
    "blendVoice" TEXT,
    "speed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ra_talk_settings_pkey" PRIMARY KEY ("id")
);

