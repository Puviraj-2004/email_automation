import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { config } from '../config/env';
import { logger } from '../modules/shared';

const router = Router();
const DATE_FOLDER_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_FILENAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

/**
 * GET /public/emails/documents/:date/:filename
 * Serves stored email attachment files.
 * Example: /public/emails/documents/2026-04-24/20260424-140800-rapport.pdf
 */
router.get('/:date/:filename', async (req: Request, res: Response) => {
  const { date, filename } = req.params;

  if (!DATE_FOLDER_PATTERN.test(date) || !SAFE_FILENAME_PATTERN.test(filename)) {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }

  const uploadRoot = path.resolve(process.cwd(), config.UPLOADS_DIR);
  const filePath = path.resolve(uploadRoot, date, filename);

  if (!filePath.startsWith(`${uploadRoot}${path.sep}`)) {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }

  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
  } catch {
    logger.warn('[DocumentsRoute] File not found', { filePath });
    res.status(404).json({ error: 'File not found' });
    return;
  }

  logger.debug('[DocumentsRoute] Serving file', { filePath });
  res.sendFile(filePath);
});

export default router;
