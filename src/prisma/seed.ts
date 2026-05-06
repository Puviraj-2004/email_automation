import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { resolveImapConfig } from '../config/imapHosts';
import { encryptSecret } from '../modules/shared';

const prisma = new PrismaClient();

const seedAccountSchema = z.object({
  label: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

const seedAccountsSchema = z.array(seedAccountSchema);

function loadSeedAccounts(): z.infer<typeof seedAccountsSchema> {
  const raw = process.env.SEED_EMAIL_ACCOUNTS_JSON;
  if (!raw) {
    console.warn('SEED_EMAIL_ACCOUNTS_JSON is not set. No email accounts were seeded.');
    return [];
  }

  const parsedJson = JSON.parse(raw) as unknown;
  return seedAccountsSchema.parse(parsedJson);
}

async function main(): Promise<void> {
  const accounts = loadSeedAccounts();
  console.log(`Seeding ${accounts.length} email account(s)...\n`);

  for (const account of accounts) {
    try {
      const imapConfig = resolveImapConfig(account.email);
      const encryptedPassword = encryptSecret(account.password);

      await prisma.emailAccount.upsert({
        where: { email: account.email },
        update: {
          label:    account.label,
          password: encryptedPassword,
          imapHost: imapConfig.host,
          imapPort: imapConfig.port,
          isActive: true,
        },
        create: {
          label:    account.label,
          email:    account.email,
          password: encryptedPassword,
          imapHost: imapConfig.host,
          imapPort: imapConfig.port,
          isActive: true,
        },
      });

      console.log(`Seeded ${account.label.padEnd(15)} ${account.email}`);
    } catch (err) {
      console.error(`Failed ${account.label.padEnd(15)} ${account.email}`);
      console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log('\nSeeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
