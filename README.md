# Bitespeed Identity Reconciliation

A REST API that links a customer's multiple contact details (email/phone) into one unified identity. Built as part of the Bitespeed backend assignment.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | [Bun](https://bun.sh) |
| **Language** | TypeScript |
| **Server** | Bun.serve (built-in HTTP server) |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team) |
| **Database** | PostgreSQL ([Neon Serverless](https://neon.tech)) |
| **Testing** | [Hurl](https://hurl.dev) (integration), Bun test (unit) |
| **Migrations** | Drizzle Kit |

## Project Structure

```
.
├── src/
│   ├── index.ts              # HTTP server & route handler
│   ├── logic.ts              # Core /identify business logic
│   ├── config.ts             # App configuration
│   ├── db/
│   │   ├── client.ts         # Neon database client
│   │   ├── schema.ts         # Drizzle table schema (Contact)
│   │   ├── seed.ts           # Database seeding script
│   │   ├── migrations/       # SQL migration files
│   │   └── test/             # DB-level test utilities
│   └── test/
│       ├── identify.hurl     # Hurl integration tests
│       └── logic.test.ts     # Unit tests for business logic
├── docs/
│   ├── problem_statement.md  # Assignment requirements
│   ├── cases-record.md       # Case tracking & edge case log
│   ├── brainstorm/           # Implementation plans
│   └── errors/               # RCA documents
├── drizzle.config.ts         # Drizzle Kit configuration
├── package.json
└── tsconfig.json
```

## Getting Started

```bash
# Install dependencies
bun install

# Set up environment variables
cp .env.example .env   # then fill in DATABASE_URL

# Run database migrations
bun run db:push

# Seed the database (optional, for testing)
bun src/db/seed.ts

# Start the dev server
bun run dev
```

The server starts at `http://localhost:3000`.

## API

### `POST /identify`

```json
{
  "email": "string or null",
  "phoneNumber": "string or null"
}
```

**Response:**

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["primary_email", "...other emails"],
    "phoneNumbers": ["primary_phone", "...other phones"],
    "secondaryContactIds": [2, 3]
  }
}
```

### `GET /`

Health check — returns `{ "status": "ok" }`.

## Testing

```bash
# Unit tests
bun test

# Integration tests (requires running server + seeded DB)
hurl --test src/test/identify.hurl
```

## Disclaimer

> This project was developed with the assistance of **Antigravity**, an AI coding assistant by Google DeepMind. AI was used for code implementation, debugging, edge case analysis, and documentation. All AI-generated suggestions were reviewed and validated by the developer.
