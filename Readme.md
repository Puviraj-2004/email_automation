# Email Automation System

An automated email fetching and processing robot built for **GOP Services**.

The system connects to multiple professional IMAP mailboxes, fetches new emails on a scheduled basis, extracts structured data from subjects and bodies, stores attachments locally, and exposes everything through a GraphQL API.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [How the Robot Works](#how-the-robot-works)
- [Email Types & Parsing](#email-types--parsing)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the Project](#running-the-project)
- [GraphQL API](#graphql-api)
- [Attachment API](#attachment-api)
- [Adding a New Email Domain](#adding-a-new-email-domain)
- [Troubleshooting](#troubleshooting)

---

## Overview

GOP Services receives emails daily from multiple insurance expert firms such as Alliance Experts, Expertizen, FEA, IDEA, and others. These emails contain vehicle damage reports, case letters, and support forms.

This system automates the entire process:

1. Connects to each mailbox via IMAP
2. Fetches only new emails since the last run
3. Parses and classifies each email by type
4. Extracts key fields from the subject and body
5. Saves PDF attachments to local storage
6. Stores all data in PostgreSQL
7. Exposes the data via GraphQL

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript (strict mode) |
| API | Apollo Server (GraphQL) |
| File Serving | Express (REST) |
| ORM | Prisma |
| Database | PostgreSQL |
| Email | node-imap + mailparser |
| Scheduler | node-cron |
| Logging | Winston |
| Validation | Zod |

---

## Project Structure

```
email-automation-system/
├── prisma/
│   ├── migrations/          # Auto-generated database migrations
│   └── schema.prisma        # Database models and relations
├── src/
│   ├── config/
│   │   ├── env.ts           # Zod-validated environment config
│   │   └── imapHosts.ts     # Maps email domains to IMAP servers
│   ├── graphql/
│   │   ├── resolvers/
│   │   │   └── resolvers.ts # GraphQL query and mutation resolvers
│   │   └── schema/
│   │       └── typeDefs.ts  # GraphQL type definitions
│   ├── modules/
│   │   ├── account/         # Email account management
│   │   │   ├── account.repository.ts
│   │   │   ├── account.service.ts
│   │   │   ├── index.ts
│   │   │   └── types.ts
│   │   ├── attachment/      # File saving and path building
│   │   │   ├── attachment.service.ts
│   │   │   ├── index.ts
│   │   │   └── types.ts
│   │   ├── email/           # IMAP fetching, parsing, deduplication
│   │   │   ├── email.fetcher.ts
│   │   │   ├── email.parser.ts
│   │   │   ├── email.repository.ts
│   │   │   ├── email.service.ts
│   │   │   ├── index.ts
│   │   │   └── types.ts
│   │   ├── robot/           # Scheduler and run tracker
│   │   │   ├── index.ts
│   │   │   ├── robot.repository.ts
│   │   │   └── robot.service.ts
│   │   └── shared/          # Logger, errors, helpers
│   │       ├── AppError.ts
│   │       ├── helpers.ts
│   │       ├── index.ts
│   │       └── logger.ts
│   ├── prisma/
│   │   └── client.ts        # Prisma singleton
│   ├── rest/
│   │   └── documents.route.ts # File serving endpoint
│   ├── index.ts             # App entry point
│   └── server.ts            # Apollo + Express setup
├── uploads/
│   └── emails/              # PDF attachments stored by date
│       └── YYYY-MM-DD/
├── logs/                    # Auto-generated log files
│   ├── combined.log
│   └── error.log
├── .env.example             # Environment variable template
├── .gitignore
├── package.json
├── README.md
└── tsconfig.json
```

---

## Database Schema

```
EmailAccount          Email                  EmailAttachment
─────────────         ──────────────────     ───────────────
id (PK)               id (PK)                id (PK)
label                 accountId (FK)         emailId (FK)
email (unique)        messageId (unique)     filename
password              subject                filePath
imapHost              body                   publicUrl
imapPort              fromEmail              mimeType
isActive              fromName               fileSize
createdAt             receivedAt             createdAt
updatedAt             emailType
                      expertRef              RobotRun
                      sinistreRef            ────────────────
                      immatriculation        id (PK)
                      insuredName            accountId (FK)
                      companyName            startedAt
                      expertFirm             finishedAt
                      createdAt              status
                                             emailsFetched
                                             emailsSkipped
                                             errorMessage
                                             fetchFrom
                                             fetchTo
```

### Email Types

| Enum | Description | Subject Pattern |
|---|---|---|
| `PV_EXPERTISE` | Damage assessment report | `P.V d'Expertise du dossier...` |
| `LETTRE` | Expert letter | `Lettre du dossier...` |
| `PEC` | Prise en charge / support form | `PEC du dossier...` |
| `OTHER` | Any other email | anything else |

---

## How the Robot Works

```
Scheduler triggers (every N minutes)
         │
         ▼
For each active EmailAccount:
         │
         ├─ Get fetchFrom (3-level priority):
         │     1. Last successful RobotRun.fetchTo
         │     2. Last stored Email.receivedAt
         │     3. 30 days ago (first run fallback)
         │
         ├─ fetchTo = now
         │
         ├─ Connect to IMAP server
         │
         ├─ Search emails SINCE day of fetchFrom
         │
         ├─ For each email found:
         │     ├─ Check internal date is in [fetchFrom, fetchTo]
         │     ├─ Check messageId not already in database (dedup)
         │     ├─ Parse subject + body → extract fields
         │     ├─ Save attachments to uploads/emails/YYYY-MM-DD/
         │     └─ Store Email + EmailAttachment records
         │
         └─ Save RobotRun record (SUCCESS or FAILED)
```

### Fetch Window Logic

The robot always remembers where it stopped using the `RobotRun` table.

```
Run 1:  fetchFrom = 30 days ago   →  fetchTo = 08:00
Run 2:  fetchFrom = 08:00         →  fetchTo = 12:00
Run 3:  fetchFrom = 12:00         →  fetchTo = 12:15
```

Even if you delete email records, the robot uses the last `RobotRun.fetchTo`
as the starting point for the next run. If you also delete robot runs, it
falls back to the last email date, and if no emails exist either, it goes
back 30 days automatically.

---

## Email Types & Parsing

### Fields extracted from subject

```
Subject: P.V d'Expertise du dossier 26045294 - No Sinistre : 101261144628 - Immatriculation : HH-370-CA
                                      ^^^^^^^^                 ^^^^^^^^^^^^                   ^^^^^^^^^
                                      expertRef                sinistreRef                    immatriculation
```

### Fields extracted from body

```
---------- REFERENCES DOSSIER --------------------
Ref. Expert      : 26045294              → expertRef
Ref. Sinistre    : 101261144628          → sinistreRef
Immat.           : HH370CA              → immatriculation
Assuré           : BUSINESS EQUITIES    → insuredName
Compagnie        : ASSURANCES DU CREDIT MUTU → companyName
--------------------------------------------------
De : ALLIANCE EXPERTS IDF               → expertFirm
```

---

## Setup & Installation

### Prerequisites

- Node.js v18 or higher
- PostgreSQL v14 or higher
- npm v9 or higher

### 1. Clone and install

```bash
git clone <repository-url>
cd email-automation-system
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in all values. See [Environment Variables](#environment-variables).

### 3. Set up database

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Add email accounts

Add each mailbox via the GraphQL API after starting the server.
See [GraphQL API — Add an email account](#mutations).

### 5. Start the server

```bash
# Development (auto-restarts on file changes)
npm run dev

# Production
npm run build
npm start
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `PORT` | ❌ | `4000` | Server port |
| `NODE_ENV` | ❌ | `development` | `development` or `production` |
| `UPLOADS_DIR` | ❌ | `./uploads/emails` | Where attachments are stored |
| `PUBLIC_BASE_URL` | ✅ | — | Base URL for attachment links |
| `ROBOT_CRON_SCHEDULE` | ❌ | `0 * * * *` | Cron schedule for the robot |

### Example `.env`

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/email_automation"
PORT=4000
NODE_ENV=development
UPLOADS_DIR=./uploads/emails
PUBLIC_BASE_URL=http://localhost:4000
ROBOT_CRON_SCHEDULE="*/15 * * * *"
```

### Cron Schedule Examples

| Value | Meaning |
|---|---|
| `"*/15 * * * *"` | Every 15 minutes |
| `"*/30 * * * *"` | Every 30 minutes |
| `"0 * * * *"` | Every hour |
| `"0 8-18 * * 1-5"` | Every hour, 8am–6pm, weekdays only |

---

## Database Setup

```bash
# Create and apply migrations
npx prisma migrate dev --name init

# Regenerate Prisma client after schema changes
npx prisma generate

# Open Prisma Studio (visual database browser)
npm run prisma:studio
```

---

## Running the Project

```bash
# Development with auto-restart
npm run dev

# Build for production
npm run build

# Start production build
npm start

# Database tools
npx prisma migrate dev     # Run new migrations
npx prisma generate        # Regenerate Prisma client
npm run prisma:studio      # Open visual DB browser
```

---

## GraphQL API

Open the GraphQL sandbox at:
```
http://localhost:4000/graphql
```

### Queries

#### List all email accounts
```graphql
query {
  emailAccounts {
    id
    label
    email
    imapHost
    isActive
    createdAt
  }
}
```

#### List all emails with filters
```graphql
query {
  emails(
    accountId: "uuid-here"
    emailType: "PV_EXPERTISE"
    sinistreRef: "101261144628"
  ) {
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

#### Get a single email
```graphql
query {
  email(id: "uuid-here") {
    id
    subject
    body
    emailType
    expertRef
    sinistreRef
    immatriculation
    insuredName
    companyName
    expertFirm
    receivedAt
    attachments {
      filename
      publicUrl
    }
  }
}
```

#### List all robot runs
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

### Mutations

#### Add an email account
```graphql
mutation {
  createEmailAccount(
    label: "Gonesse"
    email: "gonesse@gopservices.fr"
    password: "password_here"
  ) {
    id
    label
    email
    imapHost
    imapPort
  }
}
```

#### Update an account
```graphql
mutation {
  updateEmailAccount(
    id: "uuid-here"
    isActive: false
  ) {
    id
    label
    isActive
  }
}
```

#### Delete an account
```graphql
mutation {
  deleteEmailAccount(id: "uuid-here")
}
```

#### Trigger the robot manually
```graphql
mutation {
  triggerRobot
}
```

---

## Attachment API

Attachments are served via a public REST endpoint:

```
GET /public/emails/documents/:date/:filename
```

### Example

```
http://localhost:4000/public/emails/documents/2026-04-24/20260424-140800-rapport.pdf
```

The `publicUrl` field on each attachment contains the full ready-to-use URL.

---

## Adding a New Email Domain

When a new email account uses a domain not yet configured, open
`src/config/imapHosts.ts` and add the domain:

```typescript
const IMAP_HOST_MAP: Record<string, ImapHostConfig> = {
  'gopservices.fr':   { host: 'mail.gopservices.fr',   port: 993, tls: true },
  'garage-ravier.fr': { host: 'mail.garage-ravier.fr', port: 993, tls: true },
  'gmail.com':        { host: 'imap.gmail.com',        port: 993, tls: true },
  'outlook.com':      { host: 'outlook.office365.com', port: 993, tls: true },
  // Add new domain here:
  'newdomain.fr':     { host: 'mail.newdomain.fr',     port: 993, tls: true },
};
```

---

## Troubleshooting

### Robot fetches nothing on first run after deleting records

The robot uses a 3-level priority to determine where to start fetching:

1. Last successful `RobotRun.fetchTo`
2. Last stored `Email.receivedAt`
3. 30 days ago (first run fallback)

If you delete both emails and robot runs, it will automatically go back
30 days. No manual intervention needed.

### IMAP connection refused

- Check that `imapHost` is correct for the email domain in `imapHosts.ts`
- Verify the password is correct
- Make sure IMAP access is enabled in the email provider settings
- For Gmail: enable **App Passwords** in your Google Account security settings

### Database connection error

```
Error: P1010 — User was denied access
```

Check your `DATABASE_URL` in `.env`. Make sure:
- The username and password are correct
- The database `email_automation` exists
- PostgreSQL is running

Create the database if it does not exist:

```bash
psql -U postgres -c "CREATE DATABASE email_automation;"
```

### Emails parsed but all fields are null

The email does not match the expected format. The parser expects subjects like:

```
P.V d'Expertise du dossier 26045294 - No Sinistre : 101261144628 - Immatriculation : HH-370-CA
```

And body blocks like:

```
Ref. Expert      : 26045294
Ref. Sinistre    : 101261144628
Immat.           : HH370CA
Assuré           : BUSINESS EQUITIES
Compagnie        : ASSURANCES DU CREDIT MUTU
```

If the format is different, update the regex patterns in
`src/modules/email/email.parser.ts`.

### Dates showing as timestamps instead of ISO strings

Make sure your `src/graphql/resolvers/resolvers.ts` includes the
field-level date resolvers for `Email`, `RobotRun`, `EmailAccount`,
and `EmailAttachment` types.