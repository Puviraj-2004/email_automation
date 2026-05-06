import { PrismaClient } from '@prisma/client';
import { logger } from '../modules/shared/logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const prisma: PrismaClient = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

void prisma.$connect()
  .then(() => {
    logger.info('[Prisma] Database connected');
  })
  .catch((err: unknown) => {
    logger.error('[Prisma] Database connection failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  });

export default prisma;
