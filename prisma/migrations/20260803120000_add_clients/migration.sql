-- Live Chat multi-client rebuild: Client/Property/ClientLogo, plus clientId
-- scoping on ChatConversation/Enquiry/AiUsageLog. Sequenced carefully because
-- ChatConversation.clientId is a required column added to a table with real
-- existing rows (Reyse's own conversation history) -- new tables and the
-- seed "Reyse" client row are created first, existing conversations are
-- backfilled onto that seed row, and only then does the column become
-- NOT NULL with its foreign key. Every other change here is purely additive.

-- CreateTable
CREATE TABLE "ra_client" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "contactName" TEXT,
    "notificationEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "widgetKey" TEXT NOT NULL,
    "assistantName" TEXT NOT NULL DEFAULT 'Rey',
    "themeColor" TEXT NOT NULL DEFAULT '#312e81',
    "allowedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "additionalNotes" TEXT,
    "proactiveEnabled" BOOLEAN NOT NULL DEFAULT true,
    "proactiveDelaySeconds" INTEGER NOT NULL DEFAULT 30,
    "proactiveMessage" TEXT,
    "starterQuestions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ra_client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ra_property" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "checkInTime" TEXT,
    "checkOutTime" TEXT,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "houseRules" TEXT,
    "petPolicy" TEXT,
    "parkingInfo" TEXT,
    "wifiInfo" TEXT,
    "localTips" TEXT,
    "cancellationPolicy" TEXT,
    "additionalNotes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ra_property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ra_client_logo" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ra_client_logo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ra_client_widgetKey_key" ON "ra_client"("widgetKey");
CREATE INDEX "ra_client_deletedAt_idx" ON "ra_client"("deletedAt");
CREATE INDEX "ra_client_widgetKey_idx" ON "ra_client"("widgetKey");
CREATE INDEX "ra_property_clientId_deletedAt_idx" ON "ra_property"("clientId", "deletedAt");
CREATE UNIQUE INDEX "ra_client_logo_clientId_key" ON "ra_client_logo"("clientId");

-- AddForeignKey
ALTER TABLE "ra_property" ADD CONSTRAINT "ra_property_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ra_client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ra_client_logo" ADD CONSTRAINT "ra_client_logo_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ra_client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed "Reyse" as client zero of its own system -- this is what every
-- existing ChatConversation row backfills onto below, and what
-- reyse.co.uk's widget switches to pointing at once the cutover is proven
-- stable (see CLAUDE.md's Live Chat section). Zero Property rows
-- deliberately: Reyse itself isn't a holiday-let property, so its content
-- lives entirely in additionalNotes (today's DEFAULT_KNOWLEDGE text, moved
-- here verbatim) -- the system prompt builder treats a zero-property client
-- as a first-class case, not a special one. widgetKey is a FIXED literal
-- here, deliberately not random-generated like every other client's --
-- Reyse-Website's index.html embeds this exact value in its own static
-- <script data-reyse-key> tag (a separate repo, separate deploy, no
-- automatic way to pass a runtime-generated id across that boundary), and
-- it is going to be published in that page's public HTML source the moment
-- it deploys regardless, so a predictable value costs nothing here -- it
-- only matters that every other client's key stays unguessable, which this
-- one bootstrap row is deliberately exempt from.
INSERT INTO "ra_client" (
    "id", "businessName", "contactName", "notificationEmail", "contactPhone",
    "widgetKey", "assistantName", "themeColor", "allowedDomains",
    "additionalNotes", "enabled", "createdAt", "updatedAt"
) VALUES (
    'client_reyse',
    'Reyse',
    'Morgan King',
    'enquiries@reyse.co.uk',
    NULL,
    '440934aab9371c105b3cf4bc70fcea08',
    'Rey',
    '#312e81',
    ARRAY['reyse.co.uk', 'www.reyse.co.uk']::TEXT[],
    'About Reyse: an AI guest-messaging service for independent holiday-let (short-term rental) hosts. It answers guest questions instantly on the host''s own website, WhatsApp, Instagram, and Facebook, using a knowledge base the host sets up about their property (amenities, house rules, check-in times, pet policy, parking, local tips). It is not a booking platform and does not replace Airbnb or Booking.com -- it runs alongside a host''s existing channels.

Services (each sold independently, or bundled):
- Live Chat Widget: AI chat on the host''s own property website. £99/month, £500 setup.
- WhatsApp Automation: AI replies to guest WhatsApp messages, same knowledge base. £99/month, £750 setup.
- Social Media Automation: AI replies to Instagram and Facebook DMs. £99/month, £1,000 setup.
- All three bundled: £297/month, £1,500 setup combined.
- Current offer: first month free on every service, and the setup fee is currently waived too, while onboarding early hosts. No credit card needed to start.

How it works: the host tells Reyse about their property (amenities, house rules, check-in time, pet policy, parking, local tips) and can update it any time. Reyse answers guest questions from that knowledge base. If it isn''t confident about something, it collects the guest''s details and passes them to the host, who can also jump into any conversation and take over.

Data handling: guest conversations and property details are not used to train public AI models.

Getting started: fill in the contact form on the site, or ask this chat to pass details along. Someone from our team calls within 1 business day and can have a host live within 24 hours.

Contact: morgan.king@reyse.co.uk. UK-based business, GBP pricing.',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- AlterTable: AiUsageLog and Enquiry gain a permanently-nullable clientId --
-- no backfill needed, existing rows correctly stay NULL (Reyse-internal
-- usage/enquiries with no client concept).
ALTER TABLE "ra_ai_usage_log" ADD COLUMN "clientId" TEXT;
CREATE INDEX "ra_ai_usage_log_clientId_createdAt_idx" ON "ra_ai_usage_log"("clientId", "createdAt");
ALTER TABLE "ra_ai_usage_log" ADD CONSTRAINT "ra_ai_usage_log_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ra_client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ra_enquiry" ADD COLUMN "clientId" TEXT;
CREATE INDEX "ra_enquiry_clientId_idx" ON "ra_enquiry"("clientId");
ALTER TABLE "ra_enquiry" ADD CONSTRAINT "ra_enquiry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ra_client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: ChatConversation -- clientId is nullable at first specifically
-- so every existing row can be backfilled below before it becomes NOT NULL.
-- propertyId and csatHelpful are permanently nullable, no backfill needed.
ALTER TABLE "ra_chat_conversation" ADD COLUMN "clientId" TEXT;
ALTER TABLE "ra_chat_conversation" ADD COLUMN "propertyId" TEXT;
ALTER TABLE "ra_chat_conversation" ADD COLUMN "csatHelpful" BOOLEAN;

-- Backfill every existing conversation onto the seeded "Reyse" row --
-- correct because every conversation that exists at migration time really
-- did happen on reyse.co.uk's own (until-now single-tenant) widget.
UPDATE "ra_chat_conversation" SET "clientId" = 'client_reyse' WHERE "clientId" IS NULL;

-- Only now does clientId become required, once every row genuinely has one.
ALTER TABLE "ra_chat_conversation" ALTER COLUMN "clientId" SET NOT NULL;

CREATE INDEX "ra_chat_conversation_clientId_lastMessageAt_idx" ON "ra_chat_conversation"("clientId", "lastMessageAt");
ALTER TABLE "ra_chat_conversation" ADD CONSTRAINT "ra_chat_conversation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ra_client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ra_chat_conversation" ADD CONSTRAINT "ra_chat_conversation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "ra_property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
