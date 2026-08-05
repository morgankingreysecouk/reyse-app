import { db } from "@/lib/db";
import { notifyBooking } from "@/lib/dm/notifications";
import { pushBookingToGoogleCalendar, removeBookingFromGoogleCalendar } from "./google";

// Queries CalendarBlock exclusively -- never CalendarConnection.source --
// which is the entire point of normalizing iCal imports, Google imports,
// and Reyse's own confirmed bookings into one shared shape. The overlap
// condition (block starts before the requested range ends, and ends after
// the requested range starts) runs at the DB level against the indexed
// [propertyId, startDate, endDate], not fetched into JS.
export async function isRangeFree(propertyId: string, startDate: Date, endDate: Date): Promise<boolean> {
  const blocking = await db.calendarBlock.findFirst({
    where: { propertyId, startDate: { lt: endDate }, endDate: { gt: startDate } },
    select: { id: true },
  });
  return !blocking;
}

// PUBLIC_BASE_URL: app.reyse.co.uk isn't attached to this Railway service
// yet -- same workaround used throughout this feature for links that need
// to work from outside a live request.
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://reyse-app-production.up.railway.app";

export interface CreateBookingParams {
  propertyId: string;
  clientId: string;
  conversationId: string | null;
  guestName: string;
  guestContact?: string;
  startDate: Date;
  endDate: Date;
}

export interface CreateBookingResult {
  ok: boolean;
  bookingId?: string;
  reason?: string;
}

// Auto-confirm, no human review step (Morgan's explicit decision) -- the
// only safety net is this function's own re-check plus the prompt
// instructing the model to confirm exact dates with the guest first (see
// replyEngine.ts's CREATE_BOOKING_TOOL description). Field names and every
// surface this touches (the tool result, the notification email, the
// admin UI) state plainly that this blocks the dates in Reyse's own
// record -- it does not and cannot create a reservation on Airbnb or
// Booking.com directly, since no third-party API exists for that.
export async function createBooking(params: CreateBookingParams): Promise<CreateBookingResult> {
  const property = await db.property.findUnique({
    where: { id: params.propertyId },
    include: { client: true, calendarConnection: true },
  });
  if (!property) return { ok: false, reason: "Property not found" };

  // Re-checks isRangeFree inside the same transaction that creates the
  // booking -- closes the race where two concurrent guest conversations
  // both pass an earlier check_availability call before either one writes.
  const booking = await db.$transaction(async (tx) => {
    const blocking = await tx.calendarBlock.findFirst({
      where: { propertyId: params.propertyId, startDate: { lt: params.endDate }, endDate: { gt: params.startDate } },
      select: { id: true },
    });
    if (blocking) return null;

    const created = await tx.booking.create({
      data: {
        propertyId: params.propertyId,
        conversationId: params.conversationId,
        guestName: params.guestName,
        guestContact: params.guestContact,
        startDate: params.startDate,
        endDate: params.endDate,
        status: "CONFIRMED",
      },
    });
    await tx.calendarBlock.create({
      data: {
        propertyId: params.propertyId,
        source: "REYSE_BOOKING",
        externalUid: `reyse-booking:${created.id}`,
        startDate: params.startDate,
        endDate: params.endDate,
        bookingId: created.id,
      },
    });
    return created;
  });

  if (!booking) {
    return { ok: false, reason: "Those dates are no longer available." };
  }

  await db.dmActivityLog.create({
    data: {
      clientId: params.clientId,
      conversationId: params.conversationId ?? undefined,
      action: "BOOKING_CONFIRMED",
      summary: `Booked ${property.name} for ${params.guestName}, ${params.startDate.toISOString().slice(0, 10)} to ${params.endDate.toISOString().slice(0, 10)}`,
    },
  });

  // Google write-back is best-effort -- the booking already succeeded in
  // Reyse's own record above regardless of whether this push works, since
  // a Google API failure here must never undo a real confirmed booking.
  let pushedToGoogleCalendar = false;
  if (property.calendarConnection?.source === "GOOGLE") {
    try {
      const googleEventId = await pushBookingToGoogleCalendar(params.propertyId, params.startDate, params.endDate, params.guestName);
      if (googleEventId) {
        await db.booking.update({ where: { id: booking.id }, data: { googleEventId } });
        pushedToGoogleCalendar = true;
      }
    } catch (error) {
      console.error(`Failed to push booking ${booking.id} to Google Calendar:`, error);
    }
  }

  await notifyBooking({
    notificationEmail: property.client.notificationEmail,
    clientName: property.client.name,
    propertyName: property.name,
    guestName: params.guestName,
    startDate: params.startDate,
    endDate: params.endDate,
    pushedToGoogleCalendar,
    baseUrl: PUBLIC_BASE_URL,
  });

  return { ok: true, bookingId: booking.id };
}

export interface CancelBookingResult {
  ok: boolean;
  reason?: string;
}

// Morgan-initiated only (the admin UI's Bookings view), never called from
// the AI reply path -- cancelling on the guest's word alone with no human
// judgement is exactly the kind of "anything involving money/commitments
// beyond what the knowledge states" case replyEngine.ts's own system
// prompt already tells the AI to escalate rather than act on. Idempotent:
// cancelling an already-cancelled booking is a no-op success, not an error.
export async function cancelBooking(bookingId: string, clientId: string): Promise<CancelBookingResult> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { property: { include: { calendarConnection: true } } },
  });
  if (!booking || booking.property.clientId !== clientId) return { ok: false, reason: "Booking not found" };
  if (booking.status === "CANCELLED") return { ok: true };

  await db.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } });
    await tx.calendarBlock.deleteMany({ where: { propertyId: booking.propertyId, source: "REYSE_BOOKING", bookingId } });
  });

  // Best-effort, same reasoning as createBooking's own Google push: a
  // failed remote removal must never block the cancellation that already
  // succeeded in Reyse's own record.
  if (booking.googleEventId && booking.property.calendarConnection?.source === "GOOGLE") {
    try {
      await removeBookingFromGoogleCalendar(booking.propertyId, booking.googleEventId);
    } catch (error) {
      console.error(`Failed to remove booking ${bookingId} from Google Calendar:`, error);
    }
  }

  await db.dmActivityLog.create({
    data: {
      clientId,
      conversationId: booking.conversationId ?? undefined,
      action: "BOOKING_CANCELLED",
      summary: `Cancelled booking for ${booking.guestName} at ${booking.property.name}, ${booking.startDate.toISOString().slice(0, 10)} to ${booking.endDate.toISOString().slice(0, 10)}`,
    },
  });

  return { ok: true };
}
