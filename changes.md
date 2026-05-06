# Test-2 Branch Changes

This file summarizes the production-readiness and senior-review changes made on the `Test-2` branch compared with the previous project state.

## Email Retrieval Rules

- Added subject filtering so only business-relevant emails are stored.
- Emails are now skipped unless their subject contains one of:
  - `Immatriculation`
  - `Immat`
  - `No Sinistre`
  - `No Mission`
  - `Nref Mission` / `Nréf Mission`
- Non-matching emails are counted as skipped and are not stored in PostgreSQL.
- Attachments for skipped emails are not written to disk.

## Fetch Window

- Changed the first-run and fallback retrieval window from 30 days to a maximum of 2 days.
- Even when previous robot state is old or missing, the robot does not fetch emails older than the last 2 days.

## Local PostgreSQL

- Added `docker-compose.yml` with PostgreSQL 16 Alpine.
- PostgreSQL credentials are now read from environment variables instead of being hardcoded in Compose.
- PostgreSQL binds to `127.0.0.1:${POSTGRES_PORT:-5436}` by default to avoid exposing the database on all network interfaces.
- Updated `.env.example` to use:

```env
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="replace-with-a-strong-postgres-password"
POSTGRES_DB="email_automation"
POSTGRES_PORT="5436"
DATABASE_URL="postgresql://postgres:replace-with-a-strong-postgres-password@localhost:5436/email_automation"
```

## Security And Production Hardening

- Added API-key middleware for GraphQL and document routes.
- Added credential encryption helpers for mailbox passwords.
- Removed hardcoded mailbox credentials from the seed script.
- Seed data now comes from `SEED_EMAIL_ACCOUNTS_JSON`.
- Re-enabled IMAP TLS certificate verification.
- Hardened document file path validation.
- Added a `/health` endpoint.
- Limited JSON request body size to `1mb`.

## API And Data Safety

- Added GraphQL input validation with Zod.
- Added pagination defaults and limits for email and robot-run queries.
- Removed unsafe enum casting in email filters.
- Changed manual robot trigger to wait for completion and return a proper Boolean.

## Reliability

- Added an in-process robot overlap guard to prevent concurrent scheduler/manual runs in one app instance.
- Switched attachment directory creation and file writes to async filesystem calls.
- Added Prisma connection failure logging.

## Tests

- Added a `test` script.
- Added native Node tests for:
  - shared helper formatting and filename sanitization
  - credential encryption/decryption
  - email subject allowlist filtering

Run verification with:

```bash
npm test
```
