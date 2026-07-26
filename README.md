# Games & Castles

Games & Castles is a private, mobile-first companion for 31 July–2 August 2026: Friday game night in Germany, Saturday's Prague Quest, and Sunday departure and onward travel. It combines a live multi-game championship, flexible and scheduled trip plans, birthday messages, and an administrator-controlled prediction and reveal experience in a premium travel-journal and arcade-tournament interface.

> **Status:** Phase 3 repository implementation complete — the organizer Competition Studio, validated versioned drafts, atomic publication, scheduled guest cards, audit metadata, and default-deny competition Rules are implemented. Phase 2 remains deployed and connected to production Firebase. The Phase 3 Rules must be deployed separately before the live studio can write production competition data; no remote Firebase changes are made by repository setup or Pages deployment.

## Technology

- React, strict TypeScript, Vite, Tailwind CSS, Framer Motion, and Lucide icons
- Vitest, React Testing Library, ESLint, and Prettier
- GitHub Pages for the static frontend and GitHub Actions for CI/deployment
- Firebase modular Web SDK for Authentication and Realtime Database
- Firebase Emulator Suite, default-deny Realtime Database Security Rules, and Rules unit testing
- Cloud Functions and App Check remain later-phase work

## Feature areas

- Three-day weekend overview and detailed Saturday itinerary
- Generic competition configuration and scheduled guest cards; live engines and scoring begin in Phase 4
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

Phase 3 adds configuration only: organizers can create, validate, publish, reorder, archive, restore, and duplicate generic competition records, while authenticated guests receive scheduled cards in realtime. It does not generate fixtures/groups/sessions, accept results, award points, or create a score ledger. Those execution features, message submission, predictions, protected reveal operations, Cloud Functions, and App Check remain later phases according to the [implementation roadmap](docs/implementation-roadmap.md).

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
- **Phases 1–3:** repository implementation complete — static shell, Firebase participant foundation, and generic competition configuration studio.
- **Phases 4–7:** competition execution engines and ledger-derived overall championship.
- **Phases 8–9:** Birthday Vault, prediction event, and protected reveal flow.
- **Phases 10–11:** security hardening, accessibility, animation, multi-device rehearsal, and production deployment.

See the [implementation roadmap](docs/implementation-roadmap.md) for measurable phase gates.

> **Security rule:** Sensitive reveal content, credentials, protected codes, and exact private accommodation details must never be committed to this repository or bundled into the frontend.
