# Games & Castles

Games & Castles is a private, mobile-first companion for 31 July–2 August 2026: Friday game night in Germany, Saturday's Prague Quest, and Sunday departure and onward travel. It combines a live multi-game championship, flexible and scheduled trip plans, birthday messages, and an administrator-controlled prediction and reveal experience in a premium travel-journal and arcade-tournament interface.

> **Status:** Phase 6 repository implementation complete — Merry-Go-Round, All Hands, and Group Format now have format-discriminated runtimes, revision-safe organizer controls, realtime guest presentation, derived projected points, completion/reopen workflows, audit activity, and default-deny runtime Rules. Phases 2–5 are deployed and production-tested, and the production Pages site remains connected to Firebase. The Phase 6 Rules must still be deployed separately before production Group Format data can be written; repository setup and Pages deployment do not change remote Firebase resources.

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
- Organizer controls, realtime synchronization, and audit history
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

Phase 6 adds complete `group-knockout` execution alongside the deployed Merry-Go-Round and All Hands engines. Authorized organizers can preview and confirm a secure balanced draw, control single/double group round robins, resolve sporting ties, freeze qualification, review cross-group seeds and BYEs, generate/correct the knockout, and complete or reopen the run. Authenticated guests receive the persisted draw, fixtures, standings, qualification, bracket, results, and itemized projected points in realtime. The Phase 7 cross-competition score ledger, message submission, predictions, protected reveal operations, Cloud Functions, and App Check remain later phases according to the [implementation roadmap](docs/implementation-roadmap.md).

## Documentation

- [Product specification](docs/product-spec.md)
- [Competition and scoring rules](docs/game-rules.md)
- [Domain and Firebase data model](docs/data-model.md)
- [Authentication and security model](docs/security-model.md)
- [Firebase setup and operations](docs/firebase-setup.md)
- [Design system](docs/design-system.md)
- [Implementation roadmap](docs/implementation-roadmap.md)
- [Assumptions and decisions](docs/assumptions-and-decisions.md)

## Development phases

- **Phase 0:** frozen product and architecture documentation.
- **Phases 1–6:** repository implementation complete — static shell, Firebase participant foundation, generic Competition Studio, and live Merry-Go-Round, All Hands, and Group Format execution.
- **Phase 7:** ledger-derived overall championship.
- **Phases 8–9:** Birthday Vault, prediction event, and protected reveal flow.
- **Phases 10–11:** security hardening, accessibility, animation, multi-device rehearsal, and production deployment.

See the [implementation roadmap](docs/implementation-roadmap.md) for measurable phase gates.

> **Security rule:** Sensitive reveal content, credentials, protected codes, and exact private accommodation details must never be committed to this repository or bundled into the frontend.
