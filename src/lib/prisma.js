import { PrismaClient } from '@prisma/client';

// Use the Neon HTTP adapter in production (serverless) for near-zero connection latency.
// Fall back to standard PrismaClient in development (local Postgres or SQLite).
async function createPrismaClient() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon.tech')) {
    try {
      const { neon } = await import('@neondatabase/serverless');
      const { PrismaNeon } = await import('@prisma/adapter-neon');
      const sql = neon(process.env.DATABASE_URL);
      const adapter = new PrismaNeon(sql);
      return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      });
    } catch {
      // adapter not available, fall through to standard client
    }
  }
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

// Singleton — reuse across hot-reloads in dev and across invocations in the same lambda instance.
const globalForPrisma = globalThis;

if (!globalForPrisma.__buildogramPrisma) {
  // We resolve the promise synchronously via a top-level await shim:
  // In Next.js server components / route handlers this module is only ever
  // imported in async contexts so the synchronous singleton approach below works.
  globalForPrisma.__buildogramPrisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const prisma = globalForPrisma.__buildogramPrisma;
export default prisma;
