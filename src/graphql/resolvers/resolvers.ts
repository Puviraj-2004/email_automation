import { accountService } from '../../modules/account';
import { emailService } from '../../modules/email';
import { robotService } from '../../modules/robot';
import { robotRepository } from '../../modules/robot';

// Helper — converts Date or timestamp to ISO string safely
function toISO(value: Date | string | number | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value instanceof Date ? value : Number(value));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export const resolvers = {
  Query: {
    emailAccounts: () => accountService.findAll(),

    emailAccount: (_: unknown, { id }: { id: string }) =>
      accountService.findById(id),

    emails: (
      _: unknown,
      filters: { accountId?: string; emailType?: string; sinistreRef?: string },
    ) => emailService.findAll(filters),

    email: (_: unknown, { id }: { id: string }) =>
      emailService.findById(id),

    robotRuns: () => robotRepository.findAll(),
  },

  // Field-level resolvers to format dates properly
  Email: {
    receivedAt: (parent: { receivedAt: Date }) => toISO(parent.receivedAt),
    createdAt:  (parent: { createdAt: Date })  => toISO(parent.createdAt),
  },

  EmailAccount: {
    createdAt: (parent: { createdAt: Date }) => toISO(parent.createdAt),
  },

  EmailAttachment: {
    createdAt: (parent: { createdAt: Date }) => toISO(parent.createdAt),
  },

  RobotRun: {
    startedAt:  (parent: { startedAt: Date })          => toISO(parent.startedAt),
    finishedAt: (parent: { finishedAt: Date | null })   => toISO(parent.finishedAt),
    fetchFrom:  (parent: { fetchFrom: Date })           => toISO(parent.fetchFrom),
    fetchTo:    (parent: { fetchTo: Date })             => toISO(parent.fetchTo),
  },

  Mutation: {
    createEmailAccount: (
      _: unknown,
      args: { label: string; email: string; password: string },
    ) => accountService.create(args),

    updateEmailAccount: (
      _: unknown,
      { id, ...input }: { id: string; label?: string; password?: string; isActive?: boolean },
    ) => accountService.update(id, input),

    deleteEmailAccount: async (_: unknown, { id }: { id: string }) => {
      await accountService.delete(id);
      return true;
    },

    triggerRobot: async () => {
      robotService.runAllAccounts().catch(() => undefined);
      return true;
    },
  },
};