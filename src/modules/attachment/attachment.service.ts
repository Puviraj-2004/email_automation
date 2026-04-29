import fs from 'fs';
import path from 'path';
import { EmailAttachment } from '@prisma/client';
import prisma from '../../prisma/client';
import { config } from '../../config/env';
import { AppError, ErrorCode, logger, buildUploadDirPath, formatDateFilename, sanitizeFilename } from '../shared';
import { SaveAttachmentInput } from './types';

export const attachmentService = {
  async save(input: SaveAttachmentInput): Promise<EmailAttachment> {
    const uploadDir = buildUploadDirPath(config.UPLOADS_DIR, input.receivedAt);

    try {
      fs.mkdirSync(uploadDir, { recursive: true });
    } catch {
      throw new AppError(
        ErrorCode.ATTACHMENT_SAVE_FAILED,
        `Failed to create directory: ${uploadDir}`,
      );
    }

    const safeFilename = `${formatDateFilename(input.receivedAt)}-${sanitizeFilename(input.filename)}`;
    const filePath = path.join(uploadDir, safeFilename);
    const relativePath = path.relative(process.cwd(), filePath);
    const dateFolder = formatDateFilename(input.receivedAt).slice(0, 8);
    const publicUrl = `${config.PUBLIC_BASE_URL}/public/emails/documents/${dateFolder}/${safeFilename}`;

    try {
      fs.writeFileSync(filePath, input.content);
    } catch {
      throw new AppError(
        ErrorCode.ATTACHMENT_SAVE_FAILED,
        `Failed to write file: ${filePath}`,
      );
    }

    const attachment = await prisma.emailAttachment.create({
      data: {
        emailId: input.emailId,
        filename: safeFilename,
        filePath: relativePath,
        publicUrl,
        mimeType: input.mimeType,
        fileSize: input.content.length,
      },
    });

    logger.debug('[AttachmentService] Saved file', { filename: safeFilename, size: input.content.length });
    return attachment;
  },

  async findByEmailId(emailId: string): Promise<EmailAttachment[]> {
    return prisma.emailAttachment.findMany({ where: { emailId } });
  },
};