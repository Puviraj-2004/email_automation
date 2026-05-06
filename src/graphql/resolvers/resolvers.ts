import { z } from 'zod';
import { accountService } from '../../modules/account';
import { emailService } from '../../modules/email';
import { robotRepository, robotService } from '../../modules/robot';
import { AppError, ErrorCode } from '../../modules/shared';

const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

const idSchema = z.object({ id: z.string().uuid() });

const emailsQuerySchema = paginationSchema.extend({
  accountId: z.string().uuid().optional(),
  emailType: z.enum(['PV_EXPERTISE', 'LETTRE', 'PEC', 'OTHER']).optional(),
  sinistreRef: z.string().trim().min(1).max(100).optional(),
});

const createAccountSchema = z.object({
  label: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  password: z.string().min(1).max(500),
});

const updateAccountSchema = idSchema.extend({
  label: z.string().trim().min(1).max(100).optional(),
  password: z.string().min(1).max(500).optional(),
  isActive: z.boolean().optional(),
});

function parseArgs<T>(schema: z.ZodSchema<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(
      ErrorCode.VALIDATION_FAILED,
      result.error.issues[0]?.message ?? 'Invalid input',
    );
  }
  return result.data;
}

function toISO(value: Date | string | number | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export const resolvers = {
  Query: {
    emailAccounts: () => accountService.findAll(),

    emailAccount: (_: unknown, args: unknown) =>
      accountService.findById(parseArgs(idSchema, args).id),

    emails: (_: unknown, filters: unknown) =>
      emailService.findAll(parseArgs(emailsQuerySchema, filters)),

    email: (_: unknown, args: unknown) =>
      emailService.findById(parseArgs(idSchema, args).id),

    robotRuns: (_: unknown, args: unknown) =>
      robotRepository.findAll(parseArgs(paginationSchema, args)),
  },

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
    startedAt:  (parent: { startedAt: Date })        => toISO(parent.startedAt),
    finishedAt: (parent: { finishedAt: Date | null }) => toISO(parent.finishedAt),
    fetchFrom:  (parent: { fetchFrom: Date })         => toISO(parent.fetchFrom),
    fetchTo:    (parent: { fetchTo: Date })           => toISO(parent.fetchTo),
  },

  Mutation: {
    createEmailAccount: (_: unknown, args: unknown) =>
      accountService.create(parseArgs(createAccountSchema, args)),

    updateEmailAccount: (_: unknown, args: unknown) => {
      const { id, ...input } = parseArgs(updateAccountSchema, args);
      return accountService.update(id, input);
    },

    deleteEmailAccount: async (_: unknown, args: unknown) => {
      await accountService.delete(parseArgs(idSchema, args).id);
      return true;
    },

    triggerRobot: async () => {
      await robotService.runAllAccounts();
      return true;
    },
  },
};
