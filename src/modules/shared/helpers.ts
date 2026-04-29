import path from 'path';
import { format } from 'date-fns';

export function formatDateFolder(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function formatDateFilename(date: Date): string {
  return format(date, 'yyyyMMdd-HHmmss');
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._\-]/g, '-')
    .replace(/-{2,}/g, '-')
    .toLowerCase();
}

export function buildUploadDirPath(baseDir: string, date: Date): string {
  return path.join(baseDir, formatDateFolder(date));
}