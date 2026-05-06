import { EmailAccount } from '@prisma/client';
import { resolveImapConfig } from '../../config/imapHosts';
import { AppError, ErrorCode, encryptSecret, logger } from '../shared';
import { accountRepository } from './account.repository';
import { CreateEmailAccountInput, UpdateEmailAccountInput } from './types';

export const accountService = {
  async create(input: CreateEmailAccountInput): Promise<EmailAccount> {
    const existing = await accountRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError(
        ErrorCode.DB_QUERY_FAILED,
        `Account ${input.email} already exists`,
      );
    }
    const imapConfig = resolveImapConfig(input.email);
    const account = await accountRepository.create({
      ...input,
      password: encryptSecret(input.password),
      imapHost: imapConfig.host,
      imapPort: imapConfig.port,
    });
    logger.info('[AccountService] Created account', { email: input.email });
    return account;
  },

  async findAll(): Promise<EmailAccount[]> {
    return accountRepository.findAll();
  },

  async findAllActive(): Promise<EmailAccount[]> {
    return accountRepository.findAllActive();
  },

  async findById(id: string): Promise<EmailAccount> {
    const account = await accountRepository.findById(id);
    if (!account) {
      throw new AppError(ErrorCode.RECORD_NOT_FOUND, `Account not found: ${id}`);
    }
    return account;
  },

  async update(id: string, input: UpdateEmailAccountInput): Promise<EmailAccount> {
    await accountService.findById(id);
    const updated = await accountRepository.update(id, {
      ...input,
      ...(input.password && { password: encryptSecret(input.password) }),
    });
    logger.info('[AccountService] Updated account', { id });
    return updated;
  },

  async delete(id: string): Promise<void> {
    await accountService.findById(id);
    await accountRepository.delete(id);
    logger.info('[AccountService] Deleted account', { id });
  },
};
