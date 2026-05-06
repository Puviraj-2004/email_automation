import { z } from 'zod';

const optionalSecret = (minLength: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      return trimmed === '' ? undefined : trimmed;
    },
    z.string().min(minLength).optional(),
  );

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.string().default('4000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  UPLOADS_DIR: z.string().default('./uploads/emails'),
  PUBLIC_BASE_URL: z.string().url(),
  ROBOT_CRON_SCHEDULE: z.string().default('0 * * * *'),
  API_KEY: optionalSecret(24),
  CREDENTIAL_ENCRYPTION_KEY: optionalSecret(32),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  → ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`\n[Config] Invalid environment variables:\n${issues}\n`);
}

if (parsed.data.NODE_ENV === 'production') {
  const missing = [
    !parsed.data.API_KEY && 'API_KEY',
    !parsed.data.CREDENTIAL_ENCRYPTION_KEY && 'CREDENTIAL_ENCRYPTION_KEY',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`[Config] Missing required production variables: ${missing.join(', ')}`);
  }
}

export const config = parsed.data;
export type Config = typeof config;
