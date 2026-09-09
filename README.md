# Bilyo

Bilyo turns quotations into confirmed sales for Philippine service businesses. A user writes a quotation, sends it as a public link, and the client accepts or declines it on their phone without an account.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Database**: MongoDB Atlas via Mongoose
- **Styling**: Tailwind CSS
- **Authentication**: Auth.js with optional TOTP MFA
- **PDF Generation**: `@react-pdf/renderer`

## Getting Started

First, install dependencies and run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Quality & Verification

```bash
npm run typecheck   # Type check with tsc
npm run lint        # Lint check with eslint
npm run build       # Production Next.js build
npm run test        # Unit tests
```
