# Games & Castles

Games & Castles is a private, mobile-first companion for 31 July–2 August 2026: Friday game night in Germany, Saturday's Prague Quest, and Sunday departure and onward travel. It combines a live multi-game championship, flexible and scheduled trip plans, birthday messages, and an administrator-controlled prediction and reveal experience in a premium travel-journal and arcade-tournament interface.

> **Status:** Phase 0.1 — trip-range and public-accommodation decisions resolved. Application implementation has not started.

## Planned stack

- React, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide icons, and optional `canvas-confetti`
- Firebase Realtime Database, Authentication, Cloud Functions, Security Rules, and later App Check
- GitHub Pages for the static frontend and GitHub Actions for CI/deployment

## Feature areas

- Three-day weekend overview and detailed Saturday itinerary
- Generic live competition engines and overall championship
- Birthday Vault guestbook and presentation
- Prediction event and protected special reveal
- Organizer controls, realtime synchronization, and audit history
- Protected trip information

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
