# ExamForge — AI-Powered Test Generator

ExamForge is an examination paper generation and management platform for educators. It combines a curated question bank from Supabase with AI-powered question synthesis, blueprint customization, live interactive preview, answer key generation, and print/export capabilities.

---

## Architecture Overview

ExamForge is built on a **Hybrid Architecture**:
- **MVC (Model-View-Controller)** forms the core foundation, cleanly separating data access, business orchestration, and presentation.
- **Event-Driven Architecture (EDA)** manages asynchronous background tasks (such as telemetry, audit logging, and cache invalidation) without blocking user-facing HTTP responses.

```
src/
├── models/                   # Model Layer (Data Access & Schema)
│   ├── question.model.ts     # Supabase question bank queries & pagination
│   ├── curriculum.model.ts   # Class, subject, chapter & topic hierarchy
│   ├── test.model.ts         # Prisma/SQLite persistence for saved tests
│   └── lookup.model.ts       # Cached taxonomy, types & difficulty levels
│
├── controllers/              # Controller Layer (Business Orchestration)
│   ├── test.controller.ts    # Test & multi-variant batch generation
│   ├── question.controller.ts# Question bank filtering & AI regeneration
│   ├── analytics.controller.ts# Analytics, history aggregation & similarity
│   └── blueprint.controller.ts# AI blueprint suggestion
│
├── events/                   # Event-Driven Layer (Background Jobs)
│   ├── event-bus.ts          # Process-wide EventEmitter bus
│   ├── events.ts             # Event constants & typed payloads
│   └── handlers/
│       ├── test-generation.handler.ts  # Post-generation background tasks
│       └── analytics.handler.ts       # Cache stale signaling on save
│
├── app/                      # Next.js App Router
│   ├── api/                  # Thin Route Handlers (Controller delegates)
│   ├── page.tsx              # Application Entry Point
│   └── layout.tsx            # Global Layout & Providers
│
├── components/               # View Layer (React UI & Shadcn)
│   ├── test-gen/             # App shell, wizard, preview, bank, analytics
│   └── ui/                   # Reusable UI primitives
│
└── lib/                      # Core Utilities & SDK Integrations
    ├── bootstrap.ts          # Server event bus bootstrap
    ├── db.ts                 # Prisma Client singleton
    ├── supabase.ts           # Supabase client configuration
    ├── types.ts              # Domain TypeScript types
    └── ai-questions.ts       # Z.ai LLM question synthesis
```

---

## Features

- **Multi-Source Generation**: Generate from the curated question bank, purely via AI, or a hybrid mode where AI fills shortfalls.
- **Blueprint Designer**: Configure mark allocation and question breakdown across MCQ, Short Answer, and Long Answer with Easy/Medium/Hard difficulty targets.
- **Multi-Variant Batching**: Generate parallel variants (Set A, Set B, etc.) with disjoint question sets or scrambled question/option order.
- **Quality Assurance**: Detect near-duplicate or overlapping questions in papers using AI similarity analysis.
- **Answer Keys & Explanations**: Generate student-friendly explanations for model answers.
- **Print & PDF Export**: Professional print templates with customizable typography, margins, headers, and answer key attachments.
- **Analytics & History**: Track question bank coverage, Bloom's taxonomy distribution, and test creation trends.

---

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4, Radix UI Primitives, Lucide Icons
- **Database**:
  - Local SQLite via [Prisma ORM](https://www.prisma.io/) (saved test papers)
  - Remote [Supabase](https://supabase.com/) (question bank repository)
- **Runtime & Package Manager**: [Bun](https://bun.sh/) or Node.js

---

## Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/mirza-zain-ali-baig/TestForge.git
cd TestForge
```

### 2. Install dependencies
```bash
bun install
# or
npm install
```

### 3. Configure environment variables
Copy `.env.example` to `.env` and fill in your Supabase credentials:
```bash
cp .env.example .env
```

### 4. Setup Database
Generate the Prisma client and sync the local SQLite schema:
```bash
bun run db:generate
bun run db:push
```

### 5. Start Development Server
```bash
bun run dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## License

MIT
