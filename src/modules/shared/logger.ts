import { createLogger, format, transports } from 'winston';
import { config } from '../../config/env';

// ─────────────────────────────────────────────────────────────────────────────
// Development format — clean and readable, only important info
// ─────────────────────────────────────────────────────────────────────────────
const devFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(({ timestamp, level, message, ...meta }) => {
    // Only show meta if it contains useful fields
    const ignoredKeys = new Set(['account', 'schedule']);
    const filteredMeta = Object.fromEntries(
      Object.entries(meta).filter(([k]) => !ignoredKeys.has(k))
    );
    const metaStr =
      Object.keys(filteredMeta).length
        ? ` ${JSON.stringify(filteredMeta)}`
        : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Production format — JSON for log aggregation tools
// ─────────────────────────────────────────────────────────────────────────────
const prodFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json(),
);

export const logger = createLogger({
  // In development show only info and above (no debug noise)
  // In production show only info and above
  level: 'info',
  format: config.NODE_ENV === 'production' ? prodFormat : devFormat,
  transports: [
    new transports.Console(),
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});