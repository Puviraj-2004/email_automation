import test from 'node:test';
import assert from 'node:assert/strict';

test('allows only processable email subjects', async () => {
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/email_automation';
  process.env.PUBLIC_BASE_URL = 'http://localhost:4000';

  const { isProcessableEmailSubject } = await import('./email.parser');

  assert.equal(isProcessableEmailSubject('P.V - Immatriculation : HH-370-CA'), true);
  assert.equal(isProcessableEmailSubject('Lettre dossier - Immat HH370CA'), true);
  assert.equal(isProcessableEmailSubject('No Sinistre : 101261144628'), true);
  assert.equal(isProcessableEmailSubject('No Mission : 2026-001'), true);
  assert.equal(isProcessableEmailSubject('Nref Mission : ABC123'), true);
  assert.equal(isProcessableEmailSubject('Nréf Mission : ABC123'), true);
  assert.equal(isProcessableEmailSubject('Newsletter and weekly update'), false);
});
