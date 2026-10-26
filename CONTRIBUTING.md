# Contributing to ExamForge AI 🚀

First off, thank you for considering contributing to **ExamForge AI**! Open source projects thrive when developers, educators, designers, and students collaborate.

Whether you're fixing a bug, adding new curriculum subjects, improving UI responsiveness, or suggesting new assessment algorithms, all contributions are warmly welcomed.

---

## 📋 Table of Contents
- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Submitting a Pull Request](#submitting-a-pull-request)
- [Local Development Setup](#local-development-setup)
- [Running Automated Tests](#running-automated-tests)
- [Project Architecture & Tech Stack](#project-architecture--tech-stack)
- [Coding & Design Standards](#coding--design-standards)
- [Community & Getting Help](#community--getting-help)

---

## 📜 Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

---

## 💡 How Can I Contribute?

### 1. "Good First Issue" Opportunities
If you're looking for an easy place to start:
- 📚 **Expand Question Bank & Curriculum**: Add syllabus data for additional subjects (e.g., Biology, Chemistry, English, Mathematics).
- 📄 **Export Formats**: Add export engines for LaTeX (`.tex`), markdown, or raw JSON.
- 🌐 **Internationalization (i18n)**: Help translate the interface and question taxonomy into other languages (Urdu, Arabic, Spanish, French, etc.).
- 🎨 **UI Themes & Presets**: Add new question layout presets, header designs, or academy watermarks.
- 🧪 **Unit & Integration Tests**: Expand coverage for edge-case test generation blueprints and algorithms.

### 2. Reporting Bugs
- Check existing [GitHub Issues](https://github.com/mirza-zain-ali-baig/TestForge/issues) first to avoid duplicates.
- Use our [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md).
- Include clear steps to reproduce, expected vs. actual behavior, browser version, and console logs.

### 3. Suggesting Features
- Open an issue using the [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.md).
- Describe the educational problem you are trying to solve and how teachers or students would benefit.

---

## 🛠️ Local Development Setup

### Prerequisites
- **Node.js**: v20+ (v22 or v24 recommended)
- **Git**
- Optional: **Bun** or **pnpm** (npm works out of the box)

### 1. Clone & Install
```bash
# Fork the repository on GitHub, then clone your fork:
git clone https://github.com/<your-username>/TestForge.git
cd TestForge/examForge

# Install dependencies:
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Supabase database URL and optional OpenRouter / Gemini API keys for AI synthesis features. (The core deterministic question bank and test generation functions work with standard mock/seed data even without external LLM keys).

### 3. Initialize Prisma Database
```bash
npm run db:generate
npm run db:push
```

### 4. Start Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🧪 Running Automated Tests

Before submitting any code changes, ensure all automated tests pass:

```bash
# Run all 88 unit, integration, and security tests:
npm test

# Run specific suites:
npm run test:unit
npm run test:features
npm run test:integration
npm run test:security
```

We also verify design consistency with our UI linter:
```bash
node .agents/skills/hallmark/scripts/sloplint.mjs src --scope app
```

---

## 🏛️ Project Architecture & Tech Stack

- **Framework**: Next.js 16 (App Router + Turbopack)
- **Language**: TypeScript 5 (Strict Mode)
- **Styling**: Tailwind CSS v4, Lucide Icons
- **Database & Auth**: PostgreSQL (Supabase) + Prisma ORM (SQLite local cache)
- **Export Engines**:
  - `src/lib/docx-export.ts` — Native OpenXML Microsoft Word generator
  - `src/lib/paper-preview-html.ts` — Headless A4 printable HTML & Excel generator
- **Controllers**:
  - `src/controllers/test.controller.ts` — Test generation & option shuffling
  - `src/controllers/blueprint.controller.ts` — Cognitive blueprint normalization
  - `src/controllers/analytics.controller.ts` — Test overlap & difficulty metrics
  - `src/controllers/auth.controller.ts` — HMAC session signing & RBAC

---

## 🌿 Submitting a Pull Request (PR)

1. **Create a branch**:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```
2. **Make your changes**: Write clean, documented code.
3. **Commit with conventional commits**:
   - `feat(...)`: A new feature
   - `fix(...)`: A bug fix
   - `docs(...)`: Documentation changes
   - `test(...)`: Adding or refactoring tests
   - `refactor(...)`: Code refactoring without behavioral changes
4. **Push and open a PR**:
   ```bash
   git push origin feat/your-feature-name
   ```
   Open a Pull Request against `main` on GitHub. Describe your changes clearly using the PR template.

---

## 💬 Community & Getting Help

- **GitHub Discussions**: Share ideas, ask questions, or showcase your tests in [GitHub Discussions](https://github.com/mirza-zain-ali-baig/TestForge/discussions).
- **Issue Tracker**: Track bugs and planned milestones in [GitHub Issues](https://github.com/mirza-zain-ali-baig/TestForge/issues).

Thank you for helping make examination design open, accessible, and rigorous for educators everywhere!
