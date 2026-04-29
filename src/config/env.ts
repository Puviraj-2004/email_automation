import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.string().default('4000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  UPLOADS_DIR: z.string().default('./uploads/emails'),
  PUBLIC_BASE_URL: z.string().url(),
  ROBOT_CRON_SCHEDULE: z.string().default('0 * * * *'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  → ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`\n[Config] Invalid environment variables:\n${issues}\n`);
}

export const config = parsed.data;
export type Config = typeof config;