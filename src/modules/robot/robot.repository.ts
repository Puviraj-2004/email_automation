import { RobotRun, RunStatus } from '@prisma/client';
import prisma from '../../prisma/client';

export const robotRepository = {
  async createRun(accountId: string, fetchFrom: Date, fetchTo: Date): Promise<RobotRun> {
    return prisma.robotRun.create({
      data: { accountId, fetchFrom, fetchTo, status: 'RUNNING' },
    });
  },

  async completeRun(
    id: string,
    status: RunStatus,
    emailsFetched: number,
    emailsSkipped: number,
    errorMessage?: string,
  ): Promise<RobotRun> {
    return prisma.robotRun.update({
      where: { id },
      data: {
        status,
        emailsFetched,
        emailsSkipped,
        finishedAt: new Date(),
        errorMessage,
      },
    });
  },

  async findLastSuccessfulRun(accountId: string): Promise<RobotRun | null> {
    return prisma.robotRun.findFirst({
      where: { accountId, status: 'SUCCESS' },
      orderBy: { startedAt: 'desc' },
    });
  },

  // Gets the most recent email receivedAt for an account
  // Used as fallback when robot_runs table is empty
  async findLastProcessedEmailDate(accountId: string): Promise<Date | null> {
    const email = await prisma.email.findFirst({
      where: { accountId },
      orderBy: { receivedAt: 'desc' },
      select: { receivedAt: true },
    });
    return email ? email.receivedAt : null;
  },

  async findAll(): Promise<RobotRun[]> {
    return prisma.robotRun.findMany({ orderBy: { startedAt: 'desc' } });
  },
};