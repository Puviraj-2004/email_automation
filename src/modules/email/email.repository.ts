import { Email } from '@prisma/client';
import prisma from '../../prisma/client';
import { EmailFilters, ParsedEmailData } from './types';

export const emailRepository = {
  async create(accountId: string, data: ParsedEmailData): Promise<Email> {
    return prisma.email.create({
      data: {
        accountId,
        messageId:      data.messageId,
        subject:        data.subject,
        body:           data.body,
        fromEmail:      data.fromEmail,
        fromName:       data.fromName,
        receivedAt:     data.receivedAt,
        emailType:      data.emailType,
        expertRef:      data.expertRef,
        sinistreRef:    data.sinistreRef,
        immatriculation:data.immatriculation,
        insuredName:    data.insuredName,
        companyName:    data.companyName,
        expertFirm:     data.expertFirm,
      },
    });
  },

  async existsByMessageId(messageId: string): Promise<boolean> {
    const count = await prisma.email.count({ where: { messageId } });
    return count > 0;
  },

  async findAll(filters?: EmailFilters): Promise<Email[]> {
    return prisma.email.findMany({
      where: {
        ...(filters?.accountId  && { accountId:  filters.accountId }),
        ...(filters?.emailType  && { emailType:  filters.emailType }),
        ...(filters?.sinistreRef && { sinistreRef: filters.sinistreRef }),
      },
      include: { attachments: true },
      orderBy: { receivedAt: 'desc' },
      take: filters?.limit ?? 50,
      skip: filters?.offset ?? 0,
    });
  },

  async findById(id: string): Promise<Email | null> {
    return prisma.email.findUnique({
      where: { id },
      include: { attachments: true },
    });
  },
};
