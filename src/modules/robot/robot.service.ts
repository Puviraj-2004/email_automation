import cron from 'node-cron';
import { config } from '../../config/env';
import { logger } from '../shared';
import { accountService } from '../account';
import { emailService } from '../email';
import { robotRepository } from './robot.repository';

// Fallback: how many days back to fetch on very first run ever
const DEFAULT_FETCH_DAYS_BACK = 30;

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function resolveFetchFrom(accountId: string): Promise<Date> {
  // Priority 1: last successful robot run's fetchTo
  const lastRun = await robotRepository.findLastSuccessfulRun(accountId);
  if (lastRun) {
    logger.debug('[Robot] Using last robot run as fetchFrom', {
      fetchFrom: lastRun.fetchTo,
    });
    return lastRun.fetchTo;
  }

  // Priority 2: last processed email's receivedAt
  // Handles case where robot_runs was cleared but emails still exist
  const lastEmailDate = await robotRepository.findLastProcessedEmailDate(accountId);
  if (lastEmailDate) {
    logger.debug('[Robot] Using last email date as fetchFrom', {
      fetchFrom: lastEmailDate,
    });
    return lastEmailDate;
  }

  // Priority 3: first time ever — go back DEFAULT_FETCH_DAYS_BACK days
  const fallback = daysAgo(DEFAULT_FETCH_DAYS_BACK);
  logger.debug('[Robot] No previous data found — using default fetchFrom', {
    fetchFrom: fallback,
    daysBack: DEFAULT_FETCH_DAYS_BACK,
  });
  return fallback;
}

export const robotService = {
  async runAllAccounts(): Promise<void> {
    logger.info('[Robot] Starting run for all active accounts');

    const accounts = await accountService.findAllActive();

    if (accounts.length === 0) {
      logger.warn('[Robot] No active accounts found');
      return;
    }

    const now = new Date();

    for (const account of accounts) {
      let run = null;
      try {
        const fetchFrom = await resolveFetchFrom(account.id);
        const fetchTo   = now;

        // Skip if window is too small (less than 1 minute)
        // Prevents unnecessary IMAP connections
        if (fetchTo.getTime() - fetchFrom.getTime() < 60 * 1000) {
          logger.debug('[Robot] Fetch window too small — skipping', {
            account: account.email,
          });
          continue;
        }

        logger.info('[Robot] Processing account', {
          account:   account.email,
          fetchFrom: fetchFrom.toISOString(),
          fetchTo:   fetchTo.toISOString(),
        });

        run = await robotRepository.createRun(account.id, fetchFrom, fetchTo);

        const { fetched, skipped } = await emailService.processAccount(
          account.id,
          fetchFrom,
          fetchTo,
        );

        await robotRepository.completeRun(run.id, 'SUCCESS', fetched, skipped);

        logger.info('[Robot] Account run complete', {
          account: account.email,
          fetched,
          skipped,
        });

      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('[Robot] Account run failed', {
          account: account.email,
          error:   message,
        });

        if (run) {
          await robotRepository.completeRun(run.id, 'FAILED', 0, 0, message);
        }
      }
    }

    logger.info('[Robot] All accounts processed');
  },

  startScheduler(): void {
    const schedule = config.ROBOT_CRON_SCHEDULE;

    if (!cron.validate(schedule)) {
      throw new Error(`[Robot] Invalid cron schedule: ${schedule}`);
    }

    cron.schedule(schedule, async () => {
      try {
        await robotService.runAllAccounts();
      } catch (err) {
        logger.error('[Robot] Scheduler error', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    logger.info('[Robot] Scheduler started', { schedule });
  },
};