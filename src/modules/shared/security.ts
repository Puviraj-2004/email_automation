import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../../config/env';

const ENCRYPTED_PREFIX = 'enc:v1:';

function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(value: string): string {
  if (!config.CREDENTIAL_ENCRYPTION_KEY) {
    if (config.NODE_ENV === 'production') {
      throw new Error('[Security] CREDENTIAL_ENCRYPTION_KEY is required in production');
    }
    return value;
  }

  if (value.startsWith(ENCRYPTED_PREFIX)) return value;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    deriveKey(config.CREDENTIAL_ENCRYPTION_KEY),
    iv,
  );
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTED_PREFIX,
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptSecret(value: string): string {
  if (!value.startsWith(ENCRYPTED_PREFIX)) {
    if (config.NODE_ENV === 'production') {
      throw new Error('[Security] Stored credential is not encrypted');
    }
    return value;
  }

  if (!config.CREDENTIAL_ENCRYPTION_KEY) {
    throw new Error('[Security] CREDENTIAL_ENCRYPTION_KEY is required to decrypt credentials');
  }

  const [, ivRaw, tagRaw, encryptedRaw] = value.split('.');
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error('[Security] Invalid encrypted credential format');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveKey(config.CREDENTIAL_ENCRYPTION_KEY),
    Buffer.from(ivRaw, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!config.API_KEY && config.NODE_ENV !== 'production') {
    next();
    return;
  }

  const bearerToken = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  const provided = req.header('x-api-key') ?? bearerToken;
  if (!provided || provided !== config.API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}
