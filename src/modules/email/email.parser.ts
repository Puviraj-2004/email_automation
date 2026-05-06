import { EmailType } from '@prisma/client';
import { simpleParser, Attachment } from 'mailparser';
import { logger } from '../shared';
import { ParsedEmailData, ParsedAttachment } from './types';

// ── Subject patterns ──────────────────────────────────────────────────────────
const SUBJECT_EXPERT_REF   = /dossier\s+(\d+)/i;
const SUBJECT_SINISTRE_REF = /(?:no\s+sinistre|ref\.?\s*sinistre)\s*[:\-]\s*([\w\d]+)/i;
const SUBJECT_IMMAT        = /immatriculation\s*[:\-]\s*([A-Z0-9\-]+)/i;
const PROCESSABLE_SUBJECT_PATTERN = /\b(immatriculation|immat|no\s+sinistre|no\s+mission|nr[ée]f\s+mission)\b/i;

// ── Body patterns ─────────────────────────────────────────────────────────────
const BODY_EXPERT_REF   = /ref\.?\s*expert\s*[:\-]\s*(\d+)/i;
const BODY_SINISTRE_REF = /(?:ref\.?\s*sinistre|claim\s*ref)\s*[:\-]\s*([\w\d]+)/i;
const BODY_IMMAT        = /(?:immat\.|registration\s*number)\s*[:\-]\s*([A-Z0-9]+)/i;
const BODY_INSURED      = /(?:assuré|insured)\s*[:\-]\s*([^\n\r]+)/i;
const BODY_COMPANY      = /(?:compagnie|company)\s*[:\-]\s*([^\n\r]+)/i;

function extract(text: string, pattern: RegExp): string | null {
  const m = text.match(pattern);
  return m ? m[1].trim() : null;
}

function detectType(subject: string): EmailType {
  const s = subject.toLowerCase();

  if (s.includes("p.v d'expertise") || s.includes('procès verbal')) {
    return 'PV_EXPERTISE' as EmailType;
  }
  if (s.includes('lettre') || s.includes('letter')) {
    return 'LETTRE' as EmailType;
  }
  if (s.includes('pec') || s.includes('prise en charge')) {
    return 'PEC' as EmailType;
  }
  return 'OTHER' as EmailType;
}

function extractExpertFirm(body: string, fromName: string | null): string | null {
  const m = body.match(/(?:de\s*:|from\s*:)\s*([A-Z][A-Z\s\-]+?)(?:<|\n)/i);
  return m ? m[1].trim() : fromName;
}

export function isProcessableEmailSubject(subject: string): boolean {
  return PROCESSABLE_SUBJECT_PATTERN.test(subject.normalize('NFC'));
}

export async function parseEmail(rawBuffer: Buffer): Promise<ParsedEmailData> {
  const parsed = await simpleParser(rawBuffer);

  const subject    = parsed.subject ?? '';
  const textBody   = typeof parsed.text === 'string' ? parsed.text : '';
  const htmlBody   = typeof parsed.html === 'string' ? parsed.html : '';
  const body       = textBody || htmlBody;

  const fromAddr  = parsed.from?.value[0];
  const fromEmail = fromAddr?.address ?? '';
  const fromName  = fromAddr?.name ?? null;
  const receivedAt = parsed.date ?? new Date();
  const messageId  = parsed.messageId ?? `no-id-${Date.now()}`;

  const expertRef       = extract(subject, SUBJECT_EXPERT_REF)   ?? extract(body, BODY_EXPERT_REF);
  const sinistreRef     = extract(subject, SUBJECT_SINISTRE_REF) ?? extract(body, BODY_SINISTRE_REF);
  const rawImmat        = extract(subject, SUBJECT_IMMAT)        ?? extract(body, BODY_IMMAT);
  const immatriculation = rawImmat ? rawImmat.replace(/-/g, '') : null;
  const insuredName     = extract(body, BODY_INSURED)?.slice(0, 100) ?? null;
  const companyName     = extract(body, BODY_COMPANY)?.slice(0, 100) ?? null;
  const expertFirm      = extractExpertFirm(body, fromName)?.slice(0, 100) ?? null;
  const emailType       = detectType(subject);

  const attachments: ParsedAttachment[] = (parsed.attachments ?? [])
    .filter((a: Attachment) => a.content && a.filename)
    .map((a: Attachment) => ({
      filename: a.filename ?? 'attachment',
      content:  a.content as Buffer,
      mimeType: a.contentType ?? 'application/octet-stream',
    }));

  logger.debug('[EmailParser] Parsed', {
    messageId,
    subject,
    emailType,
    expertRef,
    sinistreRef,
    immatriculation,
    attachments: attachments.length,
  });

  return {
    messageId,
    subject,
    body,
    fromEmail,
    fromName,
    receivedAt,
    emailType,
    expertRef,
    sinistreRef,
    immatriculation,
    insuredName,
    companyName,
    expertFirm,
    attachments,
  };
}
