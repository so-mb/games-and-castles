# Games & Castles

Games & Castles is a private, mobile-first companion for 31 July–2 August 2026: Friday game night in Germany, Saturday's Prague Quest, and Sunday departure and onward travel. It combines a live multi-game championship, flexible and scheduled trip plans, birthday messages, and an administrator-controlled prediction and reveal experience in a premium travel-journal and arcade-tournament interface.

> **Status:** Phase 1 — static visual shell implemented. Firebase and live functionality have not started.

## Technology

- React, strict TypeScript, Vite, Tailwind CSS, Framer Motion, and Lucide icons
- Vitest, React Testing Library, ESLint, and Prettier
- GitHub Pages for the static frontend and GitHub Actions for CI/deployment
- Firebase Realtime Database, Authentication, Cloud Functions, Security Rules, and App Check beginning in later phases

## Feature areas

- Three-day weekend overview and detailed Saturday itinerary
- Generic live competition engines and overall championship
- Birthday Vault guestbook and presentation
- Prediction event and protected special reveal
- Organizer controls, realtime synchronization, and audit history
- Protected trip information

## Prerequisites

- Node.js 20.19 or newer (Node.js 24 is used in CI)
- npm 11 or a compatible npm version

## Installation

```sh
npm install
```

No environment variables or credentials are needed in Phase 1.

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
```

## Production build

```sh
npm run build
npm run preview
```

Generated `dist/` output is ignored and must not be committed.

## GitHub Pages deployment

The [Pages workflow](.github/workflows/deploy-pages.yml) builds and deploys `dist/` on pushes to `master` and through manual workflow dispatch. In the GitHub repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. Production assets use Vite's `/games-and-castles/` base path and the app uses anchor navigation rather than server-side routes.

Phase 1 is entirely static. Authentication, Firebase initialization, shared state, real tournament behavior, message submission, prediction processing, and protected reveal operations begin in Phase 2 or later according to the [implementation roadmap](docs/implementation-roadmap.md).

## Documentation

- [Product specification](docs/product-spec.md)
- [Competition and scoring rules](docs/game-rules.md)
- [Domain and Firebase data model](docs/data-model.md)
- [Authentication and security model](docs/security-model.md)
- [Design system](docs/design-system.md)
- [Implementation roadmap](docs/implementation-roadmap.md)
- [Assumptions and decisions](docs/assumptions-and-decisions.md)

## Development phases

- **Phase 0:** frozen product and architecture documentation.
- **Phases 1–2:** static visual shell, GitHub Pages delivery, and secure Firebase foundation.
- **Phases 3–7:** generic competition engines and ledger-derived overall championship.
- **Phases 8–9:** Birthday Vault, prediction event, and protected reveal flow.
- **Phases 10–11:** security hardening, accessibility, animation, multi-device rehearsal, and production deployment.

See the [implementation roadmap](docs/implementation-roadmap.md) for measurable phase gates.

> **Security rule:** Sensitive reveal content, credentials, protected codes, and exact private accommodation details must never be committed to this repository or bundled into the frontend.
