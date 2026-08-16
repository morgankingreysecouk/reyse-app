import { db } from "@/lib/db";
import { Prisma, type SocialPlatform } from "@/generated/prisma/client";

export interface MetaMessagingEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: { mid?: string; text?: string; is_echo?: boolean };
}

// Shared by the Instagram and Facebook Messenger webhook routes --
// factored out once Phase 4 needed the exact same idempotent-ingestion
// logic a second time, rather than maintaining two copies of delicate
// echo/idempotency handling that could silently drift apart (same
// reasoning src/lib/dm/oauthState.ts and src/lib/requestUrl.ts were
// factored out for elsewhere in this feature). Durably ingests one
// messaging event: finds the client this account belongs to, finds-or-
// creates the DmConversation, and idempotently records the message.
// Returns the conversation id ONLY for a genuine new inbound guest
// message (never for an echo), which is what triggers AI reply
// processing after the response is sent.
export async function ingestMessagingEvent(
  platform: SocialPlatform,
  entryId: string | undefined,
  event: MetaMessagingEvent,
): Promise<string | null> {
  if (!entryId || !event.message) return null;

  const mid = event.message.mid;
  const isEcho = event.message.is_echo === true;
  const content = event.message.text ?? "[Unsupported message type]";

  // The guest's id is always the non-Reyse side of the exchange: the
  // sender for a genuine inbound message, the recipient for an echo of
  // something Reyse's account sent.
  const guestId = isEcho ? event.recipient?.id : event.sender?.id;
  if (!guestId) return null;

  const connection = await db.clientMetaConnection.findUnique({
    where: { platform_externalAccountId: { platform, externalAccountId: entryId } },
  });
  if (!connection || connection.deletedAt) {
    console.warn(`DM webhook: no active ${platform} connection found for account ${entryId}`);
    return null;
  }

  const conversation = await db.dmConversation.upsert({
    where: { clientId_platform_externalUserId: { clientId: connection.clientId, platform, externalUserId: guestId } },
    create: {
      clientId: connection.clientId,
      platform,
      externalUserId: guestId,
      lastMessageAt: new Date(),
      ...(isEcho ? { lastOutboundAt: new Date() } : { lastInboundAt: new Date() }),
    },
    update: {
      lastMessageAt: new Date(),
      ...(isEcho ? { lastOutboundAt: new Date() } : { lastInboundAt: new Date() }),
    },
  });

  // A guest message reopens a closed thread -- a host's guest getting a
  // new question after a conversation was marked Closed shouldn't go
  // unanswered just because of stale UI state.
  if (!isEcho && conversation.status === "CLOSED") {
    await db.dmConversation.update({ where: { id: conversation.id }, data: { status: "AI_ACTIVE" } });
  }

  const existing = mid ? await db.dmMessage.findUnique({ where: { externalMessageId: mid } }) : null;
  if (existing) {
    // Already recorded -- this is Meta's echo confirming a message our own
    // AI or the admin dashboard already sent and stored (see
    // src/lib/dm/graphApi.ts), keyed on the same Meta message id. No-op,
    // by design: this is exactly the echo-arrives-before-write race the
    // old repo's own bug-fix commit identified.
    return isEcho ? null : conversation.id;
  }

  try {
    await db.dmMessage.create({
      data: {
        conversationId: conversation.id,
        role: isEcho ? "OPERATOR" : "GUEST",
        content,
        externalMessageId: mid,
      },
    });
  } catch (error) {
    // A concurrent redelivery of the same event could race the findUnique
    // check above and hit the unique constraint here instead -- treat that
    // exactly like the "already recorded" case, not a failure.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return isEcho ? null : conversation.id;
    }
    throw error;
  }

  if (isEcho) {
    // A genuinely new echo we didn't originate ourselves -- Morgan
    // replying manually from his own phone/Messenger, not through the
    // dashboard or the AI. Flip the conversation to human-controlled so
    // the AI doesn't talk over him on the next guest message -- a real
    // gap the old repo's own code review flagged and never fixed.
    await db.dmConversation.update({ where: { id: conversation.id }, data: { status: "HUMAN_ACTIVE" } });
    return null;
  }

  return conversation.id;
}
