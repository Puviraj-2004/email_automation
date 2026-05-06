import test from 'node:test';
import assert from 'node:assert/strict';

test('encrypts and decrypts secrets when configured', async () => {
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/email_automation';
  process.env.PUBLIC_BASE_URL = 'http://localhost:4000';
  process.env.CREDENTIAL_ENCRYPTION_KEY = 'a-secure-test-key-that-is-long-enough';

  const { decryptSecret, encryptSecret } = await import('./security');
  const encrypted = encryptSecret('mailbox-password');

  assert.notEqual(encrypted, 'mailbox-password');
  assert.equal(decryptSecret(encrypted), 'mailbox-password');
});
