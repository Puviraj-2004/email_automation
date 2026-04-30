import cron from 'node-cron';
import { config } from '../../config/env';
import { logger } from '../shared';
import { accountService } from '../account';
import { emailService } from '../email';
import { robotRepository } from './robot.repository';

const DEFAULT_FETCH_DAYS_BACK = 30;

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function resolveFetchFrom(accountId: string): Promise<Date> {
  const lastRun = await robotRepository.findLastSuccessfulRun(accountId);
  if (lastRun) return lastRun.fetchTo;

  const lastEmailDate = await robotRepository.findLastProcessedEmailDate(accountId);
  if (lastEmailDate) return lastEmailDate;

  return daysAgo(DEFAULT_FETCH_DAYS_BACK);
}

export const robotService = {
  async runAllAccounts(): Promise<void> {
    const accounts = await accountService.findAllActive();

    if (accounts.length === 0) {
      logger.warn('[Robot] No active accounts found');
      return;
    }

    const now = new Date();
    let totalFetched = 0;
    let totalSkipped = 0;
    let totalFailed  = 0;

    logger.info(`[Robot] Starting — ${accounts.length} account(s)`);

    for (const account of accounts) {
      let run = null;
      try {
        const fetchFrom = await resolveFetchFrom(account.id);
        const fetchTo   = now;

        if (fetchTo.getTime() - fetchFrom.getTime() < 60 * 1000) {
          continue;
        }

        run = await robotRepository.createRun(account.id, fetchFrom, fetchTo);

        const { fetched, skipped } = await emailService.processAccount(
          account.id,
          fetchFrom,
          fetchTo,
        );

        await robotRepository.completeRun(run.id, 'SUCCESS', fetched, skipped);

        totalFetched += fetched;
        totalSkipped += skipped;

        // Only log if something happened
        if (fetched > 0 || skipped > 0) {
          logger.info(`[Robot] ${account.label} — fetched: ${fetched}, skipped: ${skipped}`);
        }

      } catch (err) {
        totalFailed++;
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`[Robot] ${account.label} failed — ${message}`);

        if (run) {
          await robotRepository.completeRun(run.id, 'FAILED', 0, 0, message);
        }
      }
    }

    // Single summary line per run
    logger.info(`[Robot] Done — fetched: ${totalFetched}, skipped: ${totalSkipped}, failed: ${totalFailed}`);
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

    logger.info(`[Robot] Scheduler started — ${schedule}`);
  },
};