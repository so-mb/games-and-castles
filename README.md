# Games & Castles

Games & Castles is a private, mobile-first companion for 31 July–2 August 2026: Friday game night in Germany, Saturday's Prague Quest, and Sunday departure and onward travel. It combines a live multi-game championship, flexible and scheduled trip plans, birthday messages, and an administrator-controlled prediction and reveal experience in a premium travel-journal and arcade-tournament interface.

> **Status:** Phase 9 repository implementation complete — the protected Special Reveal supports a two-stage opening/resolution lifecycle, one owner-scoped private prediction per participant, recently reauthenticated browser controls, deterministic championship scoring, correction, reconciliation, and neutral presentation. Realtime Database Rules and the frontend remain deliberate production operator actions; this repository change did not modify remote Firebase resources.

## Technology

- React, strict TypeScript, Vite, Tailwind CSS, Framer Motion, and Lucide icons
- Vitest, React Testing Library, ESLint, and Prettier
- GitHub Pages for the static frontend and GitHub Actions for CI/deployment
- Firebase modular Web SDK for Authentication and Realtime Database
- Firebase Admin SDK for trusted local claim provisioning and emergency reveal recovery only
- Firebase Emulator Suite, default-deny Realtime Database Security Rules, and Rules integration testing
- App Check enforcement remains Phase 10 work

## Feature areas

- Three-day weekend overview and detailed Saturday itinerary
- Generic competition configuration plus complete live Merry-Go-Round, All Hands, and Group Format engines
- Birthday Vault guestbook and presentation
- Prediction event and protected special reveal
- Organizer controls, Championship Sync, revisioned manual bonuses, and audit history
- Protected trip information

## Prerequisites

- Node.js 24 or newer (Node.js 24 is used in CI)
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

Phases 1–7 are deployed and production-connected; the Phase 7 championship sources have been reconciled. Phase 8 and Phase 9 are complete in the repository but require the deliberate production rollout described in [Firebase setup](docs/firebase-setup.md). Phase 9 adds `/specialReveal` private/public lifecycle data, Firebase password reauthentication, the dedicated `specialRevealAdmin` claim, recent-auth Rules enforcement, atomic browser publication/scoring, one deterministic prediction ledger source, organizer correction/reconciliation, and realtime guest presentation. It uses only Authentication and Realtime Database in production and does not require a billing account. App Check enforcement remains Phase 10 work.

## Documentation

- [Product specification](docs/product-spec.md)
- [Competition and scoring rules](docs/game-rules.md)
- [Championship ledger and reconciliation](docs/championship-ledger.md)
- [Birthday Vault](docs/birthday-vault.md)
- [Protected Special Reveal](docs/special-reveal.md)
- [Domain and Firebase data model](docs/data-model.md)
- [Authentication and security model](docs/security-model.md)
- [Firebase setup and operations](docs/firebase-setup.md)
- [Design system](docs/design-system.md)
- [Implementation roadmap](docs/implementation-roadmap.md)
- [Assumptions and decisions](docs/assumptions-and-decisions.md)

## Development phases

- **Phase 0:** frozen product and architecture documentation.
- **Phases 1–7:** implemented, deployed, production-connected, and reconciled — static shell, Firebase participant foundation, Competition Studio, all three competition engines, and ledger-derived championship.
- **Phase 8:** repository implementation complete — private Birthday Vault submission, moderation, publication, and presentation; deployment remains an operator action.
- **Phase 9:** repository implementation complete — protected opening/resolution, private predictions, recently reauthenticated browser lifecycle controls, deterministic scoring, correction, reconciliation, and presentation; production rollout remains an operator action.
- **Phases 10–11:** security hardening, accessibility, animation, multi-device rehearsal, and production deployment.

See the [implementation roadmap](docs/implementation-roadmap.md) for measurable phase gates.

> **Security rule:** Sensitive reveal content, credentials, organizer passwords, and exact private accommodation details must never be committed to this repository or bundled into the frontend. Confirmation phrases prevent mistakes; they are not secrets.
