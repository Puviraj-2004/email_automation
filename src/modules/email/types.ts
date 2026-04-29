import { EmailType } from '@prisma/client';

export interface ParsedEmailData {
  messageId: string;
  subject: string;
  body: string;
  fromEmail: string;
  fromName: string | null;
  receivedAt: Date;
  emailType: EmailType;
  expertRef: string | null;
  sinistreRef: string | null;
  immatriculation: string | null;
  insuredName: string | null;
  companyName: string | null;
  expertFirm: string | null;
  attachments: ParsedAttachment[];
}

export interface ParsedAttachment {
  filename: string;
  content: Buffer;
  mimeType: string;
}