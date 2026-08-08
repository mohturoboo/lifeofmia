import { PrismaClient } from '@prisma/client';

/**
 * Instance Prisma unique.
 * En developpement, Next.js recharge les modules a chaque edition : sans ce
 * cache global on epuiserait le pool de connexions.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
