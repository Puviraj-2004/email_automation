import { Email } from '@prisma/client';
import { AppError, ErrorCode, decryptSecret, logger } from '../shared';
import { attachmentService } from '../attachment';
import { fetchEmailsFromAccount } from './email.fetcher';
import { isProcessableEmailSubject, parseEmail } from './email.parser';
import { emailRepository } from './email.repository';
import { accountRepository } from '../account/account.repository';
import { EmailFilters } from './types';
import { resolveImapConfig } from '../../config/imapHosts';

export const emailService = {
  /**
   * Fetches, parses, deduplicates and stores all new emails
   * for a given account within the time window [fetchFrom, fetchTo].
   * Returns { fetched, skipped } counts.
   */
  async processAccount(
    accountId: string,
    fetchFrom: Date,
    fetchTo: Date,
  ): Promise<{ fetched: number; skipped: number }> {
    const account = await accountRepository.findById(accountId);
    if (!account) {
      throw new AppError(ErrorCode.RECORD_NOT_FOUND, `Account not found: ${accountId}`);
    }

    const imapConfig = resolveImapConfig(account.email);
    const rawEmails = await fetchEmailsFromAccount(
      {
        ...account,
        password: decryptSecret(account.password),
        imapHost: imapConfig.host,
        imapPort: imapConfig.port,
      },
      fetchFrom,
      fetchTo,
    );

    let fetched = 0;
    let skipped = 0;

    for (const raw of rawEmails) {
      try {
        const parsed = await parseEmail(raw);

        if (!isProcessableEmailSubject(parsed.subject)) {
          skipped++;
          logger.debug('[EmailService] Skipping non-processable email', {
            messageId: parsed.messageId,
            subject: parsed.subject,
          });
          continue;
        }

        // Deduplication — skip if already stored
        const exists = await emailRepository.existsByMessageId(parsed.messageId);
        if (exists) {
          skipped++;
          logger.debug('[EmailService] Skipping duplicate', { messageId: parsed.messageId });
          continue;
        }

        // Save email record
        const email = await emailRepository.create(accountId, parsed);

        // Save attachments
        for (const att of parsed.attachments) {
          await attachmentService.save({
            emailId:    email.id,
            filename:   att.filename,
            content:    att.content,
            mimeType:   att.mimeType,
            receivedAt: parsed.receivedAt,
          });
        }

        fetched++;
      } catch (err) {
        logger.error('[EmailService] Failed to process email', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('[EmailService] Account processed', {
      account: account.email,
      fetched,
      skipped,
    });

    return { fetched, skipped };
  },

  async findAll(filters?: EmailFilters): Promise<Email[]> {
    return emailRepository.findAll(filters);
  },

  async findById(id: string): Promise<Email> {
    const email = await emailRepository.findById(id);
    if (!email) {
      throw new AppError(ErrorCode.RECORD_NOT_FOUND, `Email not found: ${id}`);
    }
    return email;
  },
};
