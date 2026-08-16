import { resolveMx } from "node:dns/promises";
import net from "node:net";
import type { LeadEmailVerification } from "@/generated/prisma/client";

export interface EmailVerifyResult {
  verification: LeadEmailVerification;
  reason: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPOSABLE_DOMAINS = [
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "temp-mail.org",
  "yopmail.com",
  "10minutemail.com",
  "throwawaymail.com",
  "trashmail.com",
  "getnada.com",
  "fakeinbox.com",
  "sharklasers.com",
  "dispostable.com",
];

interface SmtpSession {
  socket: net.Socket;
  // Reads one full SMTP response, which may span several lines (e.g. a
  // multi-extension EHLO reply). Per RFC 5321, every line of a response
  // except the last has a "-" immediately after the 3-digit code; the last
  // has a space. Returning only the first line (as an earlier version of
  // this did) misreads a multi-line EHLO reply as the response to EHLO
  // *and* leaves its trailing lines sitting in the buffer to be
  // misattributed to the next command's response, silently corrupting
  // every read after it.
  readResponse(): Promise<string>;
  send(line: string): void;
}

function openSmtpSession(host: string, timeoutMs: number): Promise<SmtpSession> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port: 25 });
    let buffer = "";
    let dead: Error | null = null;
    const lineQueue: string[] = [];
    const waitingForLine: { resolve: (line: string) => void; reject: (err: Error) => void }[] = [];

    // Any way the socket can die -- error, inactivity timeout, or a plain
    // close -- has to reject whichever readResponse() is currently pending,
    // not just the connect-phase promise. socket.on("error"/"timeout")
    // calling reject() only mattered before "connect" fired; once resolve()
    // has already run, that reject() is a silent no-op (a settled promise
    // can't be re-settled), so without this, a server that goes silent
    // mid-conversation left readResponse() awaiting a line that would never
    // arrive -- hanging forever rather than failing safe into RISKY.
    function fail(err: Error) {
      dead = err;
      clearTimeout(timer);
      const waiters = waitingForLine.splice(0);
      for (const w of waiters) w.reject(err);
      reject(err);
    }

    const timer = setTimeout(() => {
      socket.destroy();
      fail(new Error("SMTP connection timed out"));
    }, timeoutMs);

    function nextLine(): Promise<string> {
      const queued = lineQueue.shift();
      if (queued !== undefined) return Promise.resolve(queued);
      if (dead) return Promise.reject(dead);
      return new Promise((res, rej) => waitingForLine.push({ resolve: res, reject: rej }));
    }

    async function readResponse(): Promise<string> {
      let last: string;
      do {
        last = await nextLine();
      } while (last.length >= 4 && last[3] === "-");
      return last;
    }

    socket.on("connect", () => {
      clearTimeout(timer);
      resolve({ socket, readResponse, send: (line: string) => socket.write(`${line}\r\n`) });
    });

    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\r\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const waiter = waitingForLine.shift();
        if (waiter) waiter.resolve(line);
        else lineQueue.push(line);
      }
    });

    socket.on("error", (err) => fail(err));
    socket.on("timeout", () => {
      socket.destroy();
      fail(new Error("SMTP socket timed out"));
    });
    socket.on("close", () => fail(new Error("SMTP connection closed")));
    socket.setTimeout(timeoutMs);
  });
}

function codeOf(line: string): number {
  return parseInt(line.slice(0, 3), 10) || 0;
}

// Probes a single RCPT TO and returns its response code, having already
// sent MAIL FROM. Uses RSET between probes so two probes (real address,
// then a random bogus one) can run in the same connection rather than
// reconnecting -- that second probe is what tells a catch-all domain (which
// accepts every address, real or not) apart from one that's actually
// validating the mailbox.
async function probeRecipient(session: SmtpSession, mailFrom: string, rcptTo: string): Promise<number> {
  session.send(`MAIL FROM:<${mailFrom}>`);
  await session.readResponse();
  session.send(`RCPT TO:<${rcptTo}>`);
  const rcptLine = await session.readResponse();
  session.send("RSET");
  await session.readResponse();
  return codeOf(rcptLine);
}

async function smtpProbe(email: string, mxHost: string): Promise<"valid" | "invalid" | "catchall" | "unknown"> {
  let session: SmtpSession;
  try {
    session = await openSmtpSession(mxHost, 6000);
  } catch {
    return "unknown";
  }

  try {
    const greeting = await session.readResponse();
    if (codeOf(greeting) !== 220) return "unknown";

    session.send("EHLO leadgen.reyse.co.uk");
    await session.readResponse();

    const probeFrom = "verify@reyse.co.uk";
    const realCode = await probeRecipient(session, probeFrom, email);

    const [local, domain] = email.split("@");
    const bogusLocal = `${local}-doesnotexist-${Math.random().toString(36).slice(2, 8)}`;
    const bogusCode = await probeRecipient(session, probeFrom, `${bogusLocal}@${domain}`);

    session.send("QUIT");

    const realAccepted = realCode >= 200 && realCode < 300;
    const bogusAccepted = bogusCode >= 200 && bogusCode < 300;

    if (bogusAccepted) return "catchall"; // accepts anything -- can't confirm the real one specifically
    if (realAccepted) return "valid";
    if (realCode >= 500) return "invalid";
    return "unknown"; // 4xx temp failure/greylisting -- genuinely ambiguous
  } catch {
    return "unknown";
  } finally {
    session.socket.destroy();
  }
}

// MX lookup always runs (cheap, reliable, works from any host). The SMTP
// probe is a best-effort addition on top -- many cloud hosts (Railway
// included, unconfirmed either way at the time of writing) block outbound
// port 25 to stop spam, in which case the probe can't connect at all. When
// that happens this honestly falls back to "domain can receive mail, can't
// confirm this specific mailbox" (RISKY) rather than claiming a result it
// doesn't have.
export async function verifyEmail(email: string): Promise<EmailVerifyResult> {
  if (!EMAIL_REGEX.test(email)) {
    return { verification: "INVALID", reason: "Not a valid email format." };
  }

  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (DISPOSABLE_DOMAINS.includes(domain)) {
    return { verification: "INVALID", reason: "Disposable/temporary email domain." };
  }

  let mxHost: string | null = null;
  try {
    const records = await resolveMx(domain);
    if (records.length === 0) return { verification: "INVALID", reason: "Domain has no MX records." };
    mxHost = records.sort((a, b) => a.priority - b.priority)[0]!.exchange;
  } catch {
    return { verification: "INVALID", reason: "Domain does not resolve or has no mail server." };
  }

  const probeResult = await smtpProbe(email, mxHost);
  switch (probeResult) {
    case "valid":
      return { verification: "VALID", reason: "Mail server confirmed this mailbox exists." };
    case "invalid":
      return { verification: "INVALID", reason: "Mail server rejected this mailbox." };
    case "catchall":
      return { verification: "RISKY", reason: "Domain accepts all addresses (catch-all) -- can't confirm this specific mailbox." };
    case "unknown":
      return { verification: "RISKY", reason: "Domain has valid MX records but deliverability couldn't be directly confirmed." };
  }
}
