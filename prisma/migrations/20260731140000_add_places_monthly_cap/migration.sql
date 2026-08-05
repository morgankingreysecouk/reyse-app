-- CreateTable
CREATE TABLE "ra_lead_places_monthly_usage" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "textSearchCalls" INTEGER NOT NULL DEFAULT 0,
    "placeDetailsCalls" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ra_lead_places_monthly_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ra_lead_places_monthly_usage_month_key" ON "ra_lead_places_monthly_usage"("month");

