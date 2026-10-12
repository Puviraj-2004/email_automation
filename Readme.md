# Email Automation Robot

Automated IMAP email fetching and processing service built for **GOP Services**.

The robot connects to multiple professional mailboxes on a schedule, fetches only the emails it has not seen yet, classifies each one (expert report, letter, support form, other), extracts structured insurance-claim fields from the subject and body, stores attachments on disk, persists everything in PostgreSQL, and exposes the data through a **GraphQL API** and a small **REST file endpoint**.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Project Structure](#project-structure)
5. [Getting Started](#getting-started)
6. [Configuration](#configuration)
7. [How the Robot Works](#how-the-robot-works)
8. [Email Classification & Parsing](#email-classification--parsing)
9. [Database Schema](#database-schema)
10. [API Reference](#api-reference)
11. [Attachment Storage & Serving](#attachment-storage--serving)
12. [Managing Mailboxes](#managing-mailboxes)
13. [Logging & Error Handling](#logging--error-handling)
14. [Deployment](#deployment)
15. [Security Notes](#security-notes)
16. [Known Issues & Limitations](#known-issues--limitations)
17. [Troubleshooting](#troubleshooting)
18. [Scripts Reference](#scripts-reference)

---

## Features

- **Multi-mailbox support**: any number of IMAP accounts, each tracked independently.
- **Incremental fetching**: each run only covers the time since the previous successful run.
- **Deduplication**: emails are unique by `Message-ID`, so re-fetching never creates duplicates.
- **Smart classification**: detects P.V d'Expertise, Lettre, and PEC emails from the subject.
- **Field extraction**: expert reference, claim (sinistre) reference, licence plate, insured name, insurance company, and expert firm.
- **Attachment handling**: saves attachments into date-based folders and stores a ready-to-use public URL.
- **Run history**: every robot run is recorded (`RUNNING` / `SUCCESS` / `FAILED`) with counts and error messages.
- **Failure isolation**: if one mailbox fails, the others still run.
- **GraphQL API** for accounts, emails, and run history, plus a manual trigger mutation.
- **Validated config**: environment variables are checked with Zod at startup, so a bad config fails fast.

---

## Tech Stack

| Layer        | Technology                                    |
| ------------ | --------------------------------------------- |
| Runtime      | Node.js 18+ with TypeScript (`strict` mode)   |
| API          | Apollo Server 4 (GraphQL) on Express          |
| File serving | Express (REST)                                |
| ORM          | Prisma 5                                      |
| Database     | PostgreSQL 14+                                |
| Email        | `imap` (fetch) and `mailparser` (parsing)     |
| Scheduler    | `node-cron`                                   |
| Logging      | Winston                                       |
| Validation   | Zod                                           |
| Dates        | date-fns                                      |

---

## Architecture

```mermaid
flowchart LR
    CRON[node-cron scheduler] --> ROBOT[Robot service]
    API[GraphQL: triggerRobot] --> ROBOT
    ROBOT -->|per active account| FETCH[IMAP fetcher]
    FETCH -->|raw RFC822 buffers| PARSE[Email parser]
    PARSE --> SVC[Email service]
    SVC -->|dedupe by messageId| DB[(PostgreSQL)]
    SVC --> ATT[Attachment service]
    ATT --> DISK[(uploads/emails/YYYY-MM-DD)]
    ATT --> DB
    ROBOT -->|RobotRun records| DB
    CLIENT[Clients] -->|/graphql| GQL[Apollo Server]
    CLIENT -->|/public/emails/documents| REST[Documents route]
    GQL --> DB
    REST --> DISK
```

The code follows a simple **module → service → repository** layering:

- **Repository**: the only layer that talks to Prisma.
- **Service**: business logic (validation, orchestration, deduplication).
- **Resolvers / routes**: thin transport layer that calls services.

---

## Project Structure

```
.
├── prisma/
│   ├── schema.prisma               # Models and enums
│   └── migrations/                 # SQL migrations
├── src/
│   ├── index.ts                    # Entry point: starts server and scheduler
│   ├── server.ts                   # Express + Apollo setup
│   ├── config/
│   │   ├── env.ts                  # Zod-validated environment config
│   │   └── imapHosts.ts            # Email domain → IMAP server map
│   ├── graphql/
│   │   ├── schema/typeDefs.ts      # GraphQL type definitions
│   │   └── resolvers/resolvers.ts  # Query/Mutation/field resolvers
│   ├── rest/
│   │   └── documents.route.ts      # GET /public/emails/documents/:date/:filename
│   ├── prisma/client.ts            # Prisma client singleton
│   └── modules/
│       ├── account/                # Mailbox CRUD
│       ├── email/                  # IMAP fetcher, parser, repository, service
│       ├── attachment/             # Saves files to disk and DB
│       ├── robot/                  # Scheduler, run tracking, fetch-window logic
│       └── shared/                 # Logger, AppError/ErrorCode, helpers
├── uploads/                        # Created at runtime (git-ignored)
├── logs/                           # Created at runtime (git-ignored)
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Getting Started

### Prerequisites

- Node.js **18+** and npm
- PostgreSQL **14+**
- IMAP access to the mailboxes you want to monitor

### 1. Clone and install

```bash
git clone https://github.com/Puviraj-2004/email_automation.git
cd email_automation
npm install
```

### 2. Configure the environment

```bash
cp .env.example .env
```

Edit `.env` (see [Configuration](#configuration)).

### 3. Create the database

```bash
psql -U postgres -c "CREATE DATABASE email_automation;"
```

### 4. Run migrations and generate the Prisma client

```bash
npx prisma migrate dev      # development
npx prisma generate
```

### 5. Start the server

```bash
npm run dev                 # development, auto-restart on changes
```

On startup the server will:

1. Validate the environment.
2. Start Apollo Server at `/graphql`.
3. Mount the file route at `/public/emails/documents`.
4. Start the cron scheduler.

### 6. Add your first mailbox

Open `http://localhost:4000/graphql` and run:

```graphql
mutation {
  createEmailAccount(
    label: "Gonesse"
    email: "gonesse@gopservices.fr"
    password: "your-imap-password"
  ) {
    id
    label
    imapHost
    imapPort
  }
}
```

Then fetch immediately instead of waiting for the next cron tick:

```graphql
mutation { triggerRobot }
```

---

## Configuration

All variables are read from `.env` and validated in `src/config/env.ts`. The app refuses to start if validation fails.

| Variable              | Required | Default            | Description                                                  |
| --------------------- | :------: | ------------------ | ------------------------------------------------------------ |
| `DATABASE_URL`        |    Yes   | none               | PostgreSQL connection URL                                    |
| `PUBLIC_BASE_URL`     |    Yes   | none               | Public base URL, used to build attachment links              |
| `PORT`                |    No    | `4000`             | HTTP port                                                    |
| `NODE_ENV`            |    No    | `development`      | `development`, `production`, or `test`                       |
| `UPLOADS_DIR`         |    No    | `./uploads/emails` | Directory where attachments are stored                       |
| `ROBOT_CRON_SCHEDULE` |    No    | `0 * * * *`        | Cron expression for the robot (default: hourly)              |

### Example `.env`

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/email_automation"
PORT=4000
NODE_ENV=development
UPLOADS_DIR=./uploads/emails
PUBLIC_BASE_URL=http://localhost:4000
ROBOT_CRON_SCHEDULE="*/15 * * * *"
```

### Cron examples

| Expression         | Meaning                              |
| ------------------ | ------------------------------------ |
| `*/15 * * * *`     | Every 15 minutes                     |
| `*/30 * * * *`     | Every 30 minutes                     |
| `0 * * * *`        | Every hour                           |
| `0 8-18 * * 1-5`   | Hourly, 08:00–18:00, Monday–Friday   |

An invalid expression makes the app throw at startup.

---

## How the Robot Works

```mermaid
flowchart TD
    A[Cron tick or triggerRobot] --> B[Load active accounts]
    B --> C{For each account}
    C --> D[Resolve fetchFrom]
    D --> E{Window under 1 minute?}
    E -->|yes| C
    E -->|no| F[Create RobotRun RUNNING]
    F --> G[Connect to IMAP, open INBOX read-only]
    G --> H[SEARCH SINCE start of fetchFrom day]
    H --> I[Fetch messages, keep only INTERNALDATE in fetchFrom..fetchTo]
    I --> J[Parse each email]
    J --> K{messageId already stored?}
    K -->|yes| L[skipped++]
    K -->|no| M[Insert Email, save attachments, fetched++]
    L --> N[Complete RobotRun SUCCESS]
    M --> N
    F -. error .-> O[Complete RobotRun FAILED + errorMessage]
```

### Resolving the fetch window

For each account, `fetchFrom` is chosen by priority:

| Priority | Source                                  | When it applies                             |
| :------: | --------------------------------------- | ------------------------------------------- |
|     1    | `fetchTo` of the last **SUCCESS** run   | Normal operation                            |
|     2    | `receivedAt` of the newest stored email | `robot_runs` was cleared but emails remain  |
|     3    | 30 days ago (midnight)                  | First run ever                              |

`fetchTo` is always "now". Example:

```
Run 1:  fetchFrom = 30 days ago  →  fetchTo = 08:00
Run 2:  fetchFrom = 08:00        →  fetchTo = 12:00
Run 3:  fetchFrom = 12:00        →  fetchTo = 12:15
```

Because only **successful** runs advance the window, a failed run is retried over the same range next time.

### Behaviour details

- **Read-only access**: the INBOX is opened read-only, so the robot never marks mail as read or modifies the mailbox.
- **Two-stage date filtering**: IMAP `SINCE` only works at day granularity, so the robot fetches the whole day and then filters precisely by each message's IMAP internal date.
- **Per-email isolation**: a failure parsing or saving one email is logged and skipped. It does not fail the whole run.
- **Per-account isolation**: an account-level failure (bad password, connection error) marks that account's run `FAILED` and moves on to the next account.
- **Manual trigger**: `triggerRobot` returns `true` immediately and runs in the background. Check `robotRuns` for the outcome.

---

## Email Classification & Parsing

Parsing lives in `src/modules/email/email.parser.ts`.

### Type detection (from the subject, case-insensitive)

| Type           | Matches subject containing                    | Example                                           |
| -------------- | --------------------------------------------- | ------------------------------------------------- |
| `PV_EXPERTISE` | `p.v d'expertise` or `procès verbal`          | `P.V d'Expertise du dossier 26045294 ...`         |
| `LETTRE`       | `lettre` or `letter`                          | `Lettre du dossier ...`                           |
| `PEC`          | `pec` or `prise en charge`                    | `PEC du dossier ...`                              |
| `OTHER`        | anything else                                 |                                                   |

Checks run in that order, and the first match wins.

### Field extraction

Each field is looked up in the **subject first**, then falls back to the **body**.

| Field             | Subject pattern                         | Body pattern                       |
| ----------------- | --------------------------------------- | ---------------------------------- |
| `expertRef`       | `dossier <digits>`                      | `Ref. Expert : <digits>`           |
| `sinistreRef`     | `No Sinistre : <id>`                    | `Ref. Sinistre : <id>`             |
| `immatriculation` | `Immatriculation : <plate>`             | `Immat. : <plate>`                 |
| `insuredName`     | none                                    | `Assuré : <text>`                  |
| `companyName`     | none                                    | `Compagnie : <text>`               |
| `expertFirm`      | none                                    | `De : <FIRM NAME>`, else sender name |

Example subject:

```
P.V d'Expertise du dossier 26045294 - No Sinistre : 101261144628 - Immatriculation : HH-370-CA
                           ^^^^^^^^                ^^^^^^^^^^^^                    ^^^^^^^^^
                           expertRef               sinistreRef                     immatriculation
```

Example body block:

```
Ref. Expert      : 26045294
Ref. Sinistre    : 101261144628
Immat.           : HH370CA
Assuré           : BUSINESS EQUITIES
Compagnie        : ASSURANCES DU CREDIT MUTU
De : ALLIANCE EXPERTS IDF
```

Notes:

- Licence plates are **normalised**: dashes are removed (`HH-370-CA` → `HH370CA`).
- `insuredName`, `companyName`, and `expertFirm` are truncated to 100 characters.
- The body uses the plain-text part, and falls back to raw HTML if there is no text part.
- A missing `Message-ID` header is replaced by `no-id-<timestamp>`.
- If a field cannot be matched, it is stored as `null`.

To support a new email format, edit the regular expressions at the top of `email.parser.ts`.

---

## Database Schema

```mermaid
erDiagram
    EmailAccount ||--o{ Email : has
    EmailAccount ||--o{ RobotRun : has
    Email ||--o{ EmailAttachment : has

    EmailAccount {
        uuid id PK
        string label
        string email UK
        string password
        string imapHost
        int imapPort "default 993"
        boolean isActive "default true"
        datetime createdAt
        datetime updatedAt
    }
    Email {
        uuid id PK
        uuid accountId FK
        string messageId UK
        string subject
        text body
        string fromEmail
        string fromName
        datetime receivedAt
        enum emailType "default OTHER"
        string expertRef
        string sinistreRef
        string immatriculation
        string insuredName
        string companyName
        string expertFirm
        datetime createdAt
    }
    EmailAttachment {
        uuid id PK
        uuid emailId FK
        string filename
        string filePath
        string publicUrl
        string mimeType
        int fileSize
        datetime createdAt
    }
    RobotRun {
        uuid id PK
        uuid accountId FK
        datetime startedAt
        datetime finishedAt
        enum status "RUNNING, SUCCESS, FAILED"
        int emailsFetched
        int emailsSkipped
        text errorMessage
        datetime fetchFrom
        datetime fetchTo
    }
```

Tables are mapped to `email_accounts`, `emails`, `email_attachments`, and `robot_runs`.

**Indexes:** `emails(accountId)`, `emails(receivedAt)`, `emails(sinistreRef)`, `emails(immatriculation)`, `email_attachments(emailId)`, `robot_runs(accountId)`, `robot_runs(startedAt)`.

**Enums:** `EmailType` = `PV_EXPERTISE | LETTRE | PEC | OTHER`, `RunStatus` = `RUNNING | SUCCESS | FAILED`.

Browse the data visually with `npm run prisma:studio`.

---

## API Reference

### GraphQL: `POST /graphql`

Open `http://localhost:4000/graphql` in a browser for the Apollo Sandbox.

All timestamps are returned as ISO-8601 strings.

#### Queries

| Query                                          | Returns             | Description                           |
| ---------------------------------------------- | ------------------- | ------------------------------------- |
| `emailAccounts`                                | `[EmailAccount!]!`  | All mailboxes                         |
| `emailAccount(id)`                             | `EmailAccount`      | One mailbox                           |
| `emails(accountId, emailType, sinistreRef)`    | `[Email!]!`         | Emails, all filters optional          |
| `email(id)`                                    | `Email`             | One email, including its attachments  |
| `robotRuns`                                    | `[RobotRun!]!`      | Run history, newest first             |

```graphql
query {
  emails(emailType: "PV_EXPERTISE", sinistreRef: "101261144628") {
    id
    subject
    emailType
    expertRef
    sinistreRef
    immatriculation
    insuredName
    companyName
    expertFirm
    fromEmail
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

```graphql
query {
  robotRuns {
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

#### Mutations

| Mutation                                                | Description                                                       |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| `createEmailAccount(label, email, password)`            | Adds a mailbox; the IMAP host is resolved from the email domain   |
| `updateEmailAccount(id, label?, password?, isActive?)`  | Edits a mailbox or enables/disables it                            |
| `deleteEmailAccount(id)`                                | Deletes a mailbox                                                 |
| `triggerRobot`                                          | Starts a run for all active accounts in the background            |

```graphql
mutation {
  updateEmailAccount(id: "ACCOUNT_UUID", isActive: false) {
    id
    isActive
  }
}
```

The `password` field is **never** returned by the API.

### REST: `GET /public/emails/documents/:date/:filename`

Serves a stored attachment. See [Attachment Storage & Serving](#attachment-storage--serving).

| Status | Meaning                                  |
| :----: | ---------------------------------------- |
|  200   | File returned                            |
|  400   | Path contains `..`                       |
|  404   | File not found                           |

---

## Attachment Storage & Serving

Every attachment that has a filename and content is written to disk and recorded in `email_attachments`.

- **Directory:** `<UPLOADS_DIR>/<YYYY-MM-DD>/`, based on the email's received date.
- **Filename:** `<yyyyMMdd-HHmmss>-<sanitized-original-name>`. The name is lower-cased and any character outside `a-z 0-9 . _ -` becomes `-`.
- **Database fields:** `filePath` (relative to the working directory), `publicUrl`, `mimeType`, `fileSize`.
- **Public URL:** `PUBLIC_BASE_URL/public/emails/documents/<date>/<filename>`. Set `PUBLIC_BASE_URL` to the externally reachable address in production.

The route includes a basic `..` check against path traversal.

> **Backups:** attachments live on local disk, not in the database. Back up `UPLOADS_DIR` together with your PostgreSQL dump.

---

## Managing Mailboxes

### Supported providers

`src/config/imapHosts.ts` maps an email **domain** to IMAP settings:

| Domain             | IMAP host                |
| ------------------ | ------------------------ |
| `gopservices.fr`   | `mail.gopservices.fr`    |
| `garage-ravier.fr` | `mail.garage-ravier.fr`  |
| `gmail.com`        | `imap.gmail.com`         |
| `outlook.com`      | `outlook.office365.com`  |
| `hotmail.com`      | `outlook.office365.com`  |

All use port 993 with TLS.

### Adding a new domain

If `createEmailAccount` fails with `No IMAP config for domain ...`, add the domain:

```typescript
const IMAP_HOST_MAP: Record<string, ImapHostConfig> = {
  // ...existing entries
  'newdomain.fr': { host: 'mail.newdomain.fr', port: 993, tls: true },
};
```

Restart the server afterwards.

### Provider tips

- **Gmail:** enable 2-Step Verification and use an **App Password**, since the normal password will not work over IMAP.
- **Outlook/Office 365:** IMAP must be enabled for the mailbox, and some tenants require modern auth, which this project does not implement (basic password login only).

---

## Logging & Error Handling

**Winston** writes to the console and to files:

| Output              | Content                  |
| ------------------- | ------------------------ |
| Console             | All levels               |
| `logs/combined.log` | All levels               |
| `logs/error.log`    | `error` only             |

- In `development` the level is `debug` with coloured, human-readable output.
- In `production` the level is `info` with JSON output.

Errors use a typed `AppError` with an `ErrorCode`: `INVALID_CONFIG`, `IMAP_HOST_NOT_FOUND`, `IMAP_CONNECTION_FAILED`, `IMAP_FETCH_FAILED`, `EMAIL_PARSE_FAILED`, `ATTACHMENT_SAVE_FAILED`, `DB_QUERY_FAILED`, `RECORD_NOT_FOUND`, `ROBOT_RUN_FAILED`, `INTERNAL_ERROR`.

---

## Deployment

```bash
npm ci
npx prisma generate
npx prisma migrate deploy     # applies migrations without prompting
npm run build                 # compiles to dist/
NODE_ENV=production npm start
```

Recommendations:

- Run under a process manager (**PM2**, systemd, or Docker) so it restarts on crash.
- Run **a single instance**. The cron scheduler lives inside the process, so multiple instances would each run the robot (deduplication prevents duplicate emails, but IMAP load is multiplied).
- Put a reverse proxy (nginx/Caddy) with HTTPS in front, and set `PUBLIC_BASE_URL` to the public HTTPS URL.
- Persist `UPLOADS_DIR` and `logs/` on durable storage.

---

## Security Notes

Please read these before exposing the service beyond a trusted network.

1. **No authentication.** `/graphql` and `/public/emails/documents/*` are open. Anyone who can reach the server can read emails, add or delete accounts, and trigger the robot. Put it behind a VPN, an authenticating reverse proxy, or add auth middleware.
2. **Mailbox passwords are stored in plain text** in `email_accounts.password`. Restrict database access, and consider encrypting these values at rest or using a secrets manager.
3. **TLS certificate validation is disabled** for IMAP (`rejectUnauthorized: false` in `email.fetcher.ts`). This allows man-in-the-middle attacks. Set it to `true` once your mail servers have valid certificates.
4. **Attachments are served publicly** to anyone with the URL. Sensitive insurance documents should be protected.
5. **`.env` is git-ignored.** Never commit it.

---

## Known Issues & Limitations

| Area                 | Detail                                                                                                                                                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Attachment URLs**  | Files are saved in folders named `YYYY-MM-DD`, but `publicUrl` is built with a `YYYYMMDD` folder segment (`attachment.service.ts`). The stored URL therefore does not match the real path and the download route returns 404. Using `formatDateFolder` for the URL segment fixes it. |
| **`PEC` detection**  | The check is a plain substring match on `pec`, so other subjects containing those letters (for example "inspection") can be misclassified as `PEC`.                                                                                                      |
| **Filename clashes** | Two attachments with the same name in the same second share a path, and the second overwrites the first.                                                                                                                                                 |
| **Overlapping runs** | There is no lock between a cron run and a manual `triggerRobot`. Duplicates are prevented by the unique `messageId`, but the work is repeated.                                                                                                           |
| **Memory usage**     | All raw emails for an account are buffered in memory per run. Very large first-run backlogs may use a lot of RAM.                                                                                                                                        |
| **Auth methods**     | Only username/password IMAP login is supported (no OAuth2).                                                                                                                                                                                               |
| **Tests**            | The project has no automated tests yet.                                                                                                                                                                                                                  |

---

## Troubleshooting

### The robot fetched nothing

- Check `robotRuns` for `FAILED` runs and read `errorMessage`.
- Confirm the account has `isActive: true`.
- A window shorter than one minute is skipped on purpose.
- If you deleted emails but kept `robot_runs`, the robot resumes from the last run's `fetchTo` and will **not** re-fetch the deleted emails. To re-import, delete the account's `robot_runs` too, then also delete its emails to go back 30 days (see [fetch window](#resolving-the-fetch-window)).

### `IMAP_CONNECTION_FAILED` / authentication errors

- Verify the password and that IMAP is enabled for the mailbox.
- Gmail needs an App Password.
- Check that the host in `imapHosts.ts` is correct and port 993 is reachable from the server.

### `No IMAP config for domain "..."`

The email domain is not in `src/config/imapHosts.ts`. See [Adding a new domain](#adding-a-new-domain).

### `[Config] Invalid environment variables`

A required variable (`DATABASE_URL`, `PUBLIC_BASE_URL`) is missing or not a valid URL. The error message lists each offending key.

### Database errors (`P1010`, `P1001`)

- Check `DATABASE_URL` credentials.
- Make sure PostgreSQL is running and the `email_automation` database exists.
- Make sure migrations are applied (`npx prisma migrate deploy`).

### Emails are saved but fields are `null`

The subject or body does not match the expected patterns. Adjust the regular expressions in `src/modules/email/email.parser.ts`. Run in development mode to see `[EmailParser] Parsed` debug lines showing what was extracted.

### Attachment link returns 404

See the [attachment URL issue](#known-issues--limitations). Otherwise confirm `UPLOADS_DIR` is the same directory the server was started against, since the route resolves it relative to the working directory.

---

## Scripts Reference

| Script                   | Command                                          | Purpose                                  |
| ------------------------ | ------------------------------------------------ | ---------------------------------------- |
| `npm run dev`            | `ts-node-dev --respawn --transpile-only src/index.ts` | Development server with auto-restart |
| `npm run build`          | `tsc`                                            | Compile TypeScript to `dist/`            |
| `npm start`              | `node dist/index.js`                             | Run the compiled build                   |
| `npm run prisma:generate`| `prisma generate`                                | Regenerate the Prisma client             |
| `npm run prisma:migrate` | `prisma migrate dev`                             | Create and apply migrations (dev)        |
| `npm run prisma:studio`  | `prisma studio`                                  | Visual database browser                  |
| `npm run lint`           | `eslint src --ext .ts`                           | Lint the source                          |
| `npm run format`         | `prettier --write src`                           | Format the source                        |

---

## License

No license has been specified for this repository. Add a `LICENSE` file to define how others may use the code.
