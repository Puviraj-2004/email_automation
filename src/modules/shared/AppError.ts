export enum ErrorCode {
  INVALID_CONFIG = 'INVALID_CONFIG',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  IMAP_HOST_NOT_FOUND = 'IMAP_HOST_NOT_FOUND',
  IMAP_CONNECTION_FAILED = 'IMAP_CONNECTION_FAILED',
  IMAP_FETCH_FAILED = 'IMAP_FETCH_FAILED',
  EMAIL_PARSE_FAILED = 'EMAIL_PARSE_FAILED',
  ATTACHMENT_SAVE_FAILED = 'ATTACHMENT_SAVE_FAILED',
  DB_QUERY_FAILED = 'DB_QUERY_FAILED',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  ROBOT_RUN_FAILED = 'ROBOT_RUN_FAILED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly isOperational: boolean;

  constructor(code: ErrorCode, message: string, isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}
