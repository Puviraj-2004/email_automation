# Email Robot

Automated email fetching and processing robot for GOP Services.

Fetches emails from multiple IMAP mailboxes, extracts structured data from subjects and bodies, stores attachments locally, and exposes everything via a GraphQL API.

---

## Tech stack

- **Runtime**: Node.js + TypeScript (strict mode)
- **API**: Apollo Server (GraphQL) + Express (REST for file serving)
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Email**: node-imap + mailparser
- **Scheduler**: node-cron
- **Logging**: Winston
- **Validation**: Zod

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in all values in .env
```

### 3. Run database migrations
```bash
npm run prisma:migrate
```

### 4. Generate Prisma client
```bash
npm run prisma:generate
```

### 5. Start in development
```bash
npm run dev
```

---

## Project structure

```
src/
  config/         # Env validation, IMAP host map
  modules/
    email/        # IMAP fetcher, parser, dedup
    attachment/   # File saver, path builder
    robot/        # Scheduler, run tracker
    account/      # Email account CRUD
    shared/       # Logger, errors, helpers
  graphql/
    schema/       # GraphQL type definitions
    resolvers/    # Query + mutation resolvers
  rest/           # Express file-serving endpoint
  prisma/         # Prisma client singleton
prisma/
  schema.prisma
  migrations/
uploads/
  emails/         # PDF attachments stored by date
```

---

## Email types handled

| Type | Subject pattern | Description |
|------|----------------|-------------|
| `PV_EXPERTISE` | `P.V d'Expertise du dossier...` | Damage assessment report |
| `LETTRE` | `Lettre du dossier...` | Expert letter |
| `PEC` | `PEC du dossier...` | Prise en charge / support form |
| `OTHER` | anything else | Stored as-is |

---

## Adding a new email account

Add credentials via GraphQL mutation `createEmailAccount`. The IMAP host is resolved automatically from the email domain. To add a new domain, edit `src/config/imapHosts.ts`.

---

## API

- **GraphQL**: `http://localhost:4000/graphql`
- **Attachments**: `http://localhost:4000/public/emails/documents/{date}/{filename}`