import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { config } from '../config/env';
import { logger } from '../modules/shared';

const router = Router();

/**
 * GET /public/emails/documents/:date/:filename
 * Serves stored email attachment files.
 * Example: /public/emails/documents/2026-04-24/20260424-140800-rapport.pdf
 */
router.get('/:date/:filename', (req: Request, res: Response) => {
  const { date, filename } = req.params;

  // Basic path traversal protection
  if (date.includes('..') || filename.includes('..')) {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }

  const filePath = path.resolve(process.cwd(), config.UPLOADS_DIR, date, filename);

  if (!fs.existsSync(filePath)) {
    logger.warn('[DocumentsRoute] File not found', { filePath });
    res.status(404).json({ error: 'File not found' });
    return;
  }

  logger.debug('[DocumentsRoute] Serving file', { filePath });
  res.sendFile(filePath);
});

export default router;