import Imap from 'imap';
import { EmailAccount } from '@prisma/client';
import { AppError, ErrorCode, logger } from '../shared';

export function fetchEmailsFromAccount(
  account: EmailAccount,
  fetchFrom: Date,
  fetchTo: Date,
): Promise<Buffer[]> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user:     account.email,
      password: account.password,
      host:     account.imapHost,
      port:     account.imapPort,
      tls:      true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 15000,
      authTimeout: 10000,
    });

    const rawEmails: Buffer[] = [];

    function finish(err?: Error): void {
      try { imap.end(); } catch { /* ignore */ }
      if (err) reject(err);
      else     resolve(rawEmails);
    }

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err) => {
        if (err) return finish(new AppError(ErrorCode.IMAP_FETCH_FAILED, err.message));

        // Use SINCE at day level to cast a wide net
        // We filter precisely by timestamp AFTER parsing
        const sinceDate = new Date(fetchFrom);
        sinceDate.setHours(0, 0, 0, 0); // Start of the same day

        imap.search([['SINCE', sinceDate]], (searchErr, uids) => {
          if (searchErr) {
            return finish(new AppError(ErrorCode.IMAP_FETCH_FAILED, searchErr.message));
          }

          if (!uids || uids.length === 0) {
            logger.debug('[Fetcher] No emails found', { account: account.email });
            return finish();
          }

          logger.debug('[Fetcher] Found emails to evaluate', {
            account: account.email,
            count: uids.length,
          });

          const fetch = imap.fetch(uids, { bodies: '' });
          const chunks: Map<number, Buffer[]> = new Map();
          const dates: Map<number, Date> = new Map();

          fetch.on('message', (msg, seqno) => {
            chunks.set(seqno, []);

            msg.on('body', (stream) => {
              stream.on('data', (chunk: Buffer) => {
                chunks.get(seqno)?.push(chunk);
              });
            });

            // Get the internal date from IMAP envelope for precise filtering
            msg.once('attributes', (attrs) => {
              if (attrs.date) {
                dates.set(seqno, new Date(attrs.date));
              }
            });

            msg.once('end', () => {
              const emailDate = dates.get(seqno);
              const raw = Buffer.concat(chunks.get(seqno) ?? []);

              // Precise time-based filter — only include emails in [fetchFrom, fetchTo]
              if (emailDate && emailDate >= fetchFrom && emailDate <= fetchTo) {
                rawEmails.push(raw);
                logger.debug('[Fetcher] Email in window', {
                  account: account.email,
                  date: emailDate.toISOString(),
                });
              } else {
                logger.debug('[Fetcher] Email outside window — skipped', {
                  account: account.email,
                  date: emailDate?.toISOString(),
                  fetchFrom: fetchFrom.toISOString(),
                  fetchTo: fetchTo.toISOString(),
                });
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