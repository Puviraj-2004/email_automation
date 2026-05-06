# Email Automation System

Automated email retrieval and processing service for GOP Services.

The service connects to configured IMAP mailboxes, fetches recent emails, keeps only business-relevant messages, extracts structured fields, stores attachments locally, and exposes the data through a protected GraphQL API.

## Current Production Rules

- Only emails whose subject contains one of the following are stored:
  - `Immatriculation`
  - `Immat`
  - `No Sinistre`
  - `No Mission`
  - `Nref Mission` or `Nref Mission` with accent: `Nréf Mission`
- On first launch or fallback, the robot fetches a maximum of the last 2 days.
- GraphQL and attachment routes require an API key when `API_KEY` is configured.
- Mailbox passwords are encrypted when `CREDENTIAL_ENCRYPTION_KEY` is configured.
- PostgreSQL is provided through Docker Compose with credentials read from environment variables.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js + TypeScript |
| API | Apollo Server + GraphQL |
| REST | Express |
| ORM | Prisma |
| Database | PostgreSQL |
| Email | imap + mailparser |
| Scheduler | node-cron |
| Logging | Winston |
| Validation | Zod |
| Tests | Node test runner |

## Project Structure

```text
email-automation-system/
  prisma/
    migrations/
    schema.prisma
  src/
    config/
      env.ts
      imapHosts.ts
    graphql/
      resolvers/
      schema/
    modules/
      account/
      attachment/
      email/
      robot/
      shared/
    prisma/
      client.ts
    rest/
      documents.route.ts
    index.ts
    server.ts
  docker-compose.yml
  changes.md
  package.json
  Readme.md
```

## Prerequisites

- Node.js 20 or newer recommended
- npm
- Docker Desktop, for local PostgreSQL

## Environment Setup

Create `.env` from the example:

```powershell
Copy-Item .env.example .env
```

Database environment example:

```env
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="replace-with-a-strong-postgres-password"
POSTGRES_DB="email_automation"
POSTGRES_PORT="5436"
DATABASE_URL="postgresql://postgres:replace-with-a-strong-postgres-password@localhost:5436/email_automation"
```

Important variables:

| Variable | Required | Description |
| --- | --- | --- |
| `POSTGRES_USER` | Docker | PostgreSQL user for Docker Compose |
| `POSTGRES_PASSWORD` | Docker | PostgreSQL password for Docker Compose |
| `POSTGRES_DB` | Docker | PostgreSQL database name for Docker Compose |
| `POSTGRES_PORT` | Docker | Host port bound to PostgreSQL, default `5436` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No | API server port, default `4000` |
| `NODE_ENV` | No | `development`, `test`, or `production` |
| `UPLOADS_DIR` | No | Attachment storage directory |
| `PUBLIC_BASE_URL` | Yes | Base URL used for attachment links |
| `ROBOT_CRON_SCHEDULE` | No | Robot cron schedule |
| `API_KEY` | Production | API key for GraphQL and attachment routes |
| `CREDENTIAL_ENCRYPTION_KEY` | Production | Secret used to encrypt mailbox passwords |
| `SEED_EMAIL_ACCOUNTS_JSON` | No | Optional JSON array for local seeding |

In production, `API_KEY`, `CREDENTIAL_ENCRYPTION_KEY`, and database credentials must be provided as deployment secrets. Do not commit a real `.env` file.

## Run PostgreSQL With Docker

Start PostgreSQL:

```powershell
docker compose up -d
```

The Compose file reads `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, and `POSTGRES_PORT` from `.env`. The default port mapping binds PostgreSQL to `127.0.0.1`, so it is reachable from the host machine but not exposed on all network interfaces.

For a real production server, prefer a managed PostgreSQL service or a private Docker network without publishing the database port publicly. If you keep PostgreSQL in Docker, use strong secrets from your deployment platform and restrict network access with firewall rules.

Check container status:

```powershell
docker compose ps
```

View database logs:

```powershell
docker compose logs -f postgres
```

Stop PostgreSQL:

```powershell
docker compose down
```

Stop PostgreSQL and remove local database data:

```powershell
docker compose down -v
```

## Install And Prepare Database

Install dependencies:

```powershell
npm install
```

Generate Prisma client:

```powershell
npm run prisma:generate
```

Run local migrations:

```powershell
npm run prisma:migrate
```

For production deployments, use:

```powershell
npx prisma migrate deploy
```

Open Prisma Studio:

```powershell
npm run prisma:studio
```

## Run The App Locally

Development mode:

```powershell
npm run dev
```

Build:

```powershell
npm run build
```

Run built app:

```powershell
npm start
```

Run tests:

```powershell
npm test
```

Health check:

```text
GET http://localhost:4000/health
```

## API Access

GraphQL endpoint:

```text
POST http://localhost:4000/graphql
```

If `API_KEY` is configured, send one of these headers:

```text
x-api-key: your-api-key
```

or:

```text
Authorization: Bearer your-api-key
```

## GraphQL Examples

Create an email account:

```graphql
mutation {
  createEmailAccount(
    label: "Gonesse"
    email: "gonesse@gopservices.fr"
    password: "mailbox-password"
  ) {
    id
    label
    email
    imapHost
    imapPort
  }
}
```

List emails with pagination:

```graphql
query {
  emails(limit: 50, offset: 0) {
    id
    subject
    emailType
    sinistreRef
    immatriculation
    receivedAt
    attachments {
      filename
      publicUrl
      mimeType
      fileSize
    }
  }
}
```

Trigger the robot manually:

```graphql
mutation {
  triggerRobot
}
```

List robot runs:

```graphql
query {
  robotRuns(limit: 20, offset: 0) {
    id
    status
    emailsFetched
    emailsSkipped
    errorMessage
    fetchFrom
    fetchTo
    startedAt
    finishedAt
  }
}
```

## Attachment URLs

Attachments are served from:

```text
GET /public/emails/documents/:date/:filename
```

Example:

```text
http://localhost:4000/public/emails/documents/2026-04-24/20260424-140800-rapport.pdf
```

This route is protected by the same API-key middleware when `API_KEY` is configured.

## Optional Local Seeding

The seed script no longer contains hardcoded mailbox credentials.

Set `SEED_EMAIL_ACCOUNTS_JSON` in `.env` as a JSON array:

```env
SEED_EMAIL_ACCOUNTS_JSON='[{"label":"Demo","email":"demo@example.com","password":"mailbox-password"}]'
```

Then run:

```powershell
npm run prisma:seed
```

Passwords are encrypted before storage when `CREDENTIAL_ENCRYPTION_KEY` is configured.

## Add A New IMAP Domain

If an email domain is not supported, add it in `src/config/imapHosts.ts`:

```ts
const IMAP_HOST_MAP = {
  'gopservices.fr': { host: 'mail.gopservices.fr', port: 993, tls: true },
  'newdomain.fr': { host: 'mail.newdomain.fr', port: 993, tls: true },
};
```

## Troubleshooting

Database connection fails:

- Make sure Docker is running.
- Start PostgreSQL with `docker compose up -d`.
- Confirm `.env` uses port `5436`.
- Run migrations with `npm run prisma:migrate`.

API returns `Unauthorized`:

- Send `x-api-key` or `Authorization: Bearer <key>`.
- Make sure the key matches `API_KEY` in `.env`.

Robot stores no emails:

- Confirm the email subject contains one of the allowed keywords.
- Confirm the email date is within the last 2 days on first/fallback runs.
- Confirm the mailbox domain exists in `src/config/imapHosts.ts`.

IMAP connection fails:

- Confirm mailbox credentials.
- Confirm IMAP access is enabled for the provider.
- Confirm the IMAP host and port are correct.

## Branch Notes

See `changes.md` for a summary of what changed in the `Test-2` branch.
