import { PrismaClient } from '@prisma/client';
import { resolveImapConfig } from '../config/imapHosts';

const prisma = new PrismaClient();

const accounts = [
  {
    label: 'Gonesse',
    email: 'gonesse@gopservices.fr',
    password: 'Goness3@201712345',
  },
  {
    label: 'Tesla',
    email: 'tesla@gopservices.fr',
    password: '$T3ph@nie201712345',
  },
  {
    label: 'Paris 16',
    email: 'paris16@gopservices.fr',
    password: 'Luis@paris16201712345',
  },
  {
    label: 'Garage Ravier',
    email: 'm.gomes@garage-ravier.fr',
    password: 'Michel@2017OM',
  },
  {
    label: 'Aguesseau',
    email: 'aguesseau@gopservices.fr',
    password: 'Aguesseau@201712345',
  },
  {
    label: 'Bruno Esteves',
    email: 'bruno.esteves@garage-ravier.fr',
    password: 'Brunoesteves2017',
  },
];

async function main(): Promise<void> {
  console.log('Seeding email accounts...\n');

  for (const account of accounts) {
    try {
      const imapConfig = resolveImapConfig(account.email);

      await prisma.emailAccount.upsert({
        where: { email: account.email },
        update: {
          label:    account.label,
          password: account.password,
          imapHost: imapConfig.host,
          imapPort: imapConfig.port,
          isActive: true,
        },
        create: {
          label:    account.label,
          email:    account.email,
          password: account.password,
          imapHost: imapConfig.host,
          imapPort: imapConfig.port,
          isActive: true,
        },
      });

      console.log(`✓ ${account.label.padEnd(15)} ${account.email}`);
    } catch (err) {
      console.error(`✗ ${account.label.padEnd(15)} ${account.email}`);
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