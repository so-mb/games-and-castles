# Games & Castles

Games & Castles is a private, mobile-first companion for 31 July–2 August 2026: Friday game night in Germany, Saturday's Prague Quest, and three Sunday departure groups leaving Prague from Central Bus Station Florenc. It combines a live multi-game championship, flexible and scheduled trip plans, birthday messages, and an administrator-controlled prediction and reveal experience in a premium travel-journal and arcade-tournament interface.

> **Status:** Phase 11 UI/UX polish complete in the repository — shared controls and modal focus are stable, organizer workspaces are less crowded, participant avatars offer a broader themed selection, and new competition wins receive accessible dismissible celebrations without replaying old results on refresh. Phase 9 is deployed and production-tested; Phase 10 and Phase 11 repository changes still require deliberate rollout and final physical-device rehearsal.

## Technology

- React, strict TypeScript, Vite, Tailwind CSS, Framer Motion, and Lucide icons
- Vitest, React Testing Library, ESLint, and Prettier
- GitHub Pages for the static frontend and GitHub Actions for CI/deployment
- Firebase modular Web SDK for Authentication and Realtime Database
- Firebase Admin SDK for trusted local claim provisioning and emergency reveal recovery only
- Firebase Emulator Suite, default-deny Realtime Database Security Rules, and Rules integration testing
- Optional staged App Check for both guest and organizer clients; enforcement remains off until a separate evidence-based operator decision

## Feature areas

- Three-day weekend overview, detailed Saturday itinerary, and Sunday Florenc departure board
- Generic competition configuration plus complete live Merry-Go-Round, All Hands, and Group Format engines
- Birthday Vault guestbook and presentation
- Prediction event and protected special reveal
- Organizer controls, Championship Sync, revisioned manual bonuses, audit history, and sanitized Operations diagnostics
- Protected trip information

## Prerequisites

- Node.js 24 or newer (Node.js 24 is used in CI)
- npm 11 or a compatible npm version
- Java 21 or newer for the local Firebase Emulator Suite

## Installation

```sh
npm install
```

Installation also enables the tracked pre-commit hook. Before each commit, Prettier updates only supported staged files and ESLint checks/fixes only staged JavaScript and TypeScript files; lint-staged preserves partially staged work. CI repeats repository-wide `format:check` and lint checks independently.

Copy `.env.example` to `.env.local` and add the public Firebase web-app configuration to enable live features. The app still builds and serves the complete static trip page when configuration is absent. See [Firebase setup](docs/firebase-setup.md) for console, emulator, repository-variable, and organizer-provisioning guidance.

## Development

```sh
npm run dev
```

The Vite development server prints the local URL. The production site uses the `/games-and-castles/` repository subpath.

Available quality commands:

```sh
npm run lint
npm run format
npm run format:check
npm run precommit
npm run typecheck
npm run test
npm run test:run
npm run test:rules
npm run test:ops:reset-emulator
npm run emulators
npm run security:scan
npm run security:audit
npm run security:check
```

Trusted local backup, cleanup, and pre-participant project-reset commands are documented in the [operations runbook](docs/operations-runbook.md). The reset command defaults to dry-run, refuses CI, and must never be added to a deployment workflow.

## Production build

```sh
npm run build
npm run preview
```

Generated `dist/` output is ignored and must not be committed.

## GitHub Pages deployment

The [Pages workflow](.github/workflows/deploy-pages.yml) builds and deploys `dist/` on pushes to `master` and through manual workflow dispatch. The production repository uses **GitHub Actions** as its Pages source and has all six core `VITE_FIREBASE_*` public values configured as repository **Actions variables**, not secrets; the workflow maps them only into the build. Optional App Check variables are also mapped but may remain disabled. Production assets use Vite's `/games-and-castles/` base path, the app uses anchor navigation rather than server-side routes, and the deployed site is successfully connected to Firebase.

Phases 1–9 are deployed, production-connected, and production-tested; championship sources have been reconciled. Phase 10 security hardening and the Phase 11 UI/UX polish pass are complete in the repository and require the deliberate rollout described in [Firebase setup](docs/firebase-setup.md) and the [operations runbook](docs/operations-runbook.md). App Check is defense in depth, initializes only when explicitly configured, reports safe degraded status, never exposes tokens, and is not automatically enforced. No billing account, Blaze plan, Cloud Functions, Firestore, Storage, Scheduler, or paid API is introduced.

## Documentation

- [Product specification](docs/product-spec.md)
- [Competition and scoring rules](docs/game-rules.md)
- [Championship ledger and reconciliation](docs/championship-ledger.md)
- [Birthday Vault](docs/birthday-vault.md)
- [Protected Special Reveal](docs/special-reveal.md)
- [Domain and Firebase data model](docs/data-model.md)
- [Authentication and security model](docs/security-model.md)
- [Firebase setup and operations](docs/firebase-setup.md)
- [Security hardening](docs/security-hardening.md)
- [Operations runbook](docs/operations-runbook.md)
- [Pre-event checklist](docs/pre-event-checklist.md)
- [Privacy and retention](docs/privacy-retention.md)
- [Design system](docs/design-system.md)
- [Implementation roadmap](docs/implementation-roadmap.md)
- [Assumptions and decisions](docs/assumptions-and-decisions.md)

## Development phases

- **Phase 0:** frozen product and architecture documentation.
- **Phases 1–7:** implemented, deployed, production-connected, and reconciled — static shell, Firebase participant foundation, Competition Studio, all three competition engines, and ledger-derived championship.
- **Phases 8–9:** implemented, deployed, and production-tested — private Birthday Vault, protected Special Reveal, prediction scoring, correction, reconciliation, and presentation.
- **Phase 10:** repository implementation complete — staged App Check, organizer-session hardening, Operations diagnostics, version awareness, supply-chain checks, encrypted backup, and bounded private-data cleanup; remote rollout remains an operator action.
- **Phase 11:** UI/UX polish implemented — shared control alignment, stable modal focus, organizer-workspace grouping, expanded participant avatars, and reconnect-safe winner celebrations are complete; physical-device rehearsal and the final production readiness gate remain open.

See the [implementation roadmap](docs/implementation-roadmap.md) for measurable phase gates.

> **Security rule:** Sensitive reveal content, credentials, organizer passwords, and exact private accommodation details must never be committed to this repository or bundled into the frontend. Confirmation phrases prevent mistakes; they are not secrets.
