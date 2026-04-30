import Imap from 'imap';
import { EmailAccount } from '@prisma/client';
import { AppError, ErrorCode, logger } from '../shared';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function connectAndFetch(
  account: EmailAccount,
  fetchFrom: Date,
  fetchTo: Date,
): Promise<Buffer[]> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user:       account.email,
      password:   account.password,
      host:       account.imapHost,
      port:       account.imapPort,
      tls:        true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 20000,
      authTimeout: 15000,
    });

    const rawEmails: Buffer[] = [];

    function finish(err?: Error): void {
      try { imap.end(); } catch { /* ignore */ }
      if (err) reject(err);
      else     resolve(rawEmails);
    }

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err) => {
        if (err) {
          return finish(new AppError(ErrorCode.IMAP_FETCH_FAILED, err.message));
        }

        const sinceDate = new Date(fetchFrom);
        sinceDate.setHours(0, 0, 0, 0);

        imap.search([['SINCE', sinceDate]], (searchErr, uids) => {
          if (searchErr) {
            return finish(new AppError(ErrorCode.IMAP_FETCH_FAILED, searchErr.message));
          }

          if (!uids || uids.length === 0) {
            return finish();
          }

          const fetch = imap.fetch(uids, { bodies: '' });
          const chunks: Map<number, Buffer[]> = new Map();
          const dates: Map<number, Date>      = new Map();

          fetch.on('message', (msg, seqno) => {
            chunks.set(seqno, []);

            msg.on('body', (stream) => {
              stream.on('data', (chunk: Buffer) => {
                chunks.get(seqno)?.push(chunk);
              });
            });

            msg.once('attributes', (attrs) => {
              if (attrs.date) {
                dates.set(seqno, new Date(attrs.date));
              }
            });

            msg.once('end', () => {
              const emailDate = dates.get(seqno);
              const raw = Buffer.concat(chunks.get(seqno) ?? []);

              if (emailDate && emailDate >= fetchFrom && emailDate <= fetchTo) {
                rawEmails.push(raw);
              }
            });
          });

          fetch.once('error', (fetchErr) => {
            finish(new AppError(ErrorCode.IMAP_FETCH_FAILED, fetchErr.message));
          });

          fetch.once('end', () => finish());
        });
      });
    });

    imap.once('error', (err: Error) => {
      finish(new AppError(ErrorCode.IMAP_CONNECTION_FAILED, err.message));
    });

    imap.connect();
  });
}

export async function fetchEmailsFromAccount(
  account: EmailAccount,
  fetchFrom: Date,
  fetchTo: Date,
): Promise<Buffer[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const emails = await connectAndFetch(account, fetchFrom, fetchTo);
      return emails;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      const isConnReset = lastError.message.includes('ECONNRESET') ||
                          lastError.message.includes('ETIMEDOUT') ||
                          lastError.message.includes('ECONNREFUSED');

      if (isConnReset && attempt < MAX_RETRIES) {
        logger.warn(
          `[Fetcher] ${account.label} connection error — retrying (${attempt}/${MAX_RETRIES})`,
        );
        await delay(RETRY_DELAY_MS * attempt);
        continue;
      }

      // Non-retryable error or max retries reached
      break;
    }
  }

  throw lastError ?? new AppError(ErrorCode.IMAP_CONNECTION_FAILED, 'Unknown error');
}