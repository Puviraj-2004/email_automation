import { EmailAccount } from '@prisma/client';
import prisma from '../../prisma/client';
import { CreateEmailAccountInput, UpdateEmailAccountInput } from './types';

export const accountRepository = {
  async create(
    input: CreateEmailAccountInput & { imapHost: string; imapPort: number },
  ): Promise<EmailAccount> {
    return prisma.emailAccount.create({ data: input });
  },

  async findAll(): Promise<EmailAccount[]> {
    return prisma.emailAccount.findMany({ orderBy: { createdAt: 'asc' } });
  },

  async findAllActive(): Promise<EmailAccount[]> {
    return prisma.emailAccount.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  },

  async findById(id: string): Promise<EmailAccount | null> {
    return prisma.emailAccount.findUnique({ where: { id } });
  },

  async findByEmail(email: string): Promise<EmailAccount | null> {
    return prisma.emailAccount.findUnique({ where: { email } });
  },

  async update(id: string, input: UpdateEmailAccountInput): Promise<EmailAccount> {
    return prisma.emailAccount.update({ where: { id }, data: input });
  },

  async delete(id: string): Promise<void> {
    await prisma.emailAccount.delete({ where: { id } });
  },
};