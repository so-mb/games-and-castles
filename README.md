# Games & Castles

Games & Castles is a private, mobile-first companion for 31 July–2 August 2026: Friday game night in Germany, Saturday's Prague Quest, and Sunday departure and onward travel. It combines a live multi-game championship, flexible and scheduled trip plans, birthday messages, and an administrator-controlled prediction and reveal experience in a premium travel-journal and arcade-tournament interface.

> **Status:** Phase 7 repository implementation complete — Phase 6 is deployed and production-tested, and all three live engines now feed a deterministic, itemized championship ledger. The public site derives its realtime podium, shared-rank leaderboard, contributions, latest awards, participant explanations, and achievements from current ledger entries. Organizer Mode adds Championship Sync and revisioned manual bonuses. The Phase 7 Rules and frontend still require deliberate deployment, followed by one organizer reconciliation of existing production runs; this repository change did not modify remote Firebase resources.

## Technology

- React, strict TypeScript, Vite, Tailwind CSS, Framer Motion, and Lucide icons
- Vitest, React Testing Library, ESLint, and Prettier
- GitHub Pages for the static frontend and GitHub Actions for CI/deployment
- Firebase modular Web SDK for Authentication and Realtime Database
- Firebase Emulator Suite, default-deny Realtime Database Security Rules, and Rules unit testing
- Cloud Functions and App Check remain later-phase work

## Feature areas

- Three-day weekend overview and detailed Saturday itinerary
- Generic competition configuration plus complete live Merry-Go-Round, All Hands, and Group Format engines
- Birthday Vault guestbook and presentation
- Prediction event and protected special reveal
- Organizer controls, Championship Sync, revisioned manual bonuses, and audit history
- Protected trip information

## Prerequisites

- Node.js 20.19 or newer (Node.js 24 is used in CI)
- npm 11 or a compatible npm version
- Java 21 or newer for the local Firebase Emulator Suite

## Installation

```sh
npm install
```

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
npm run typecheck
npm run test
npm run test:run
npm run test:rules
npm run emulators
```

## Production build

```sh
npm run build
npm run preview
```

Generated `dist/` output is ignored and must not be committed.

## GitHub Pages deployment

The [Pages workflow](.github/workflows/deploy-pages.yml) builds and deploys `dist/` on pushes to `master` and through manual workflow dispatch. The production repository uses **GitHub Actions** as its Pages source and has all six `VITE_FIREBASE_*` public values configured as repository **Actions variables**, not secrets; the workflow maps them only into the build. Production assets use Vite's `/games-and-castles/` base path, the app uses anchor navigation rather than server-side routes, and the deployed site is successfully connected to Firebase.

Phase 6 is deployed and production-tested. Phase 7 adds `/championshipLedger/competitionSources`, a public active-bonus projection, a restricted bonus history, deterministic full-source replacement alongside runtime mutations, strict client validation, and organizer-only reconciliation for runs created before the ledger existed. No mutable participant total or persisted leaderboard cache exists. See the [championship ledger](docs/championship-ledger.md) for the production backfill sequence. Birthday submissions, predictions, protected reveal operations, Cloud Functions, and App Check remain later phases according to the [implementation roadmap](docs/implementation-roadmap.md).

## Documentation

- [Product specification](docs/product-spec.md)
- [Competition and scoring rules](docs/game-rules.md)
- [Championship ledger and reconciliation](docs/championship-ledger.md)
- [Domain and Firebase data model](docs/data-model.md)
- [Authentication and security model](docs/security-model.md)
- [Firebase setup and operations](docs/firebase-setup.md)
- [Design system](docs/design-system.md)
- [Implementation roadmap](docs/implementation-roadmap.md)
- [Assumptions and decisions](docs/assumptions-and-decisions.md)

## Development phases

- **Phase 0:** frozen product and architecture documentation.
- **Phases 1–6:** implemented, deployed, and production-tested — static shell, Firebase participant foundation, Competition Studio, and all three competition engines.
- **Phase 7:** repository implementation complete — ledger-derived championship, reconciliation, and manual bonuses; deployment/backfill remains an operator action.
- **Phases 8–9:** Birthday Vault, prediction event, and protected reveal flow.
- **Phases 10–11:** security hardening, accessibility, animation, multi-device rehearsal, and production deployment.

See the [implementation roadmap](docs/implementation-roadmap.md) for measurable phase gates.

> **Security rule:** Sensitive reveal content, credentials, protected codes, and exact private accommodation details must never be committed to this repository or bundled into the frontend.
