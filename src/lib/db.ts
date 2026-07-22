import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Standard Next.js singleton pattern -- without this, dev's hot reload
// creates a fresh PrismaClient (and a fresh connection pool) on every file
// change, which exhausts Postgres's connection limit within minutes.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Prisma 7 requires a driver adapter for a direct (non-Accelerate)
// connection -- the schema no longer carries the connection URL itself.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
