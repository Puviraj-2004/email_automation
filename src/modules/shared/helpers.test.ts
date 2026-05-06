import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  buildUploadDirPath,
  formatDateFilename,
  formatDateFolder,
  sanitizeFilename,
} from './helpers';

test('formats upload folders and filenames consistently', () => {
  const date = new Date(2026, 3, 24, 14, 8, 0);

  assert.equal(formatDateFolder(date), '2026-04-24');
  assert.equal(formatDateFilename(date), '20260424-140800');
  assert.equal(
    buildUploadDirPath('uploads/emails', date),
    path.join('uploads/emails', '2026-04-24'),
  );
});

test('sanitizes filenames for public file routes', () => {
  assert.equal(sanitizeFilename('../My Report (Final).PDF'), '..-my-report-final-.pdf');
  assert.equal(sanitizeFilename('a---b.pdf'), 'a-b.pdf');
});
