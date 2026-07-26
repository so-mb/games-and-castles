# Firebase setup and operations

## 1. Phase 2–4 scope

Firebase powers anonymous guest identity, the shared active-participant roster, organizer email/password authentication, organizer participant management, Phase 3 competition configuration, and the Phase 4 Merry-Go-Round runtime. The static itinerary and all Phase 1 presentation sections continue to render when Firebase is unconfigured or unavailable.

Phase 4 stores public-safe active/completed competition records and `/competitionRuns/{competitionId}` snapshots, draws, fixtures, round-winner result sequences, tie decisions, knockout dependencies, placements, revisions, and compact audit metadata. Standings and projected competition points are derived rather than persisted. It does not implement All Hands/Group execution, a global score ledger, messages, predictions, protected reveal data, the exact accommodation address, Cloud Functions, App Check, analytics, or service-worker behavior.

> **Production status (26 July 2026):** Phases 2–3 are deployed and production-verified. The production Firebase project and organizer access are provisioned, all six public Firebase web-configuration values are present as GitHub Actions repository variables, and the deployed GitHub Pages site is successfully connected to Firebase. The Phase 4 repository implementation and emulator-tested runtime Rules are complete, but this implementation did not deploy them or change remote Firebase data.

## 2. Create the Firebase projects

Use separate development and production Firebase projects. In each project:

1. Register a Web app. Firebase's web configuration is a public project identifier, not a server secret.
2. Enable **Authentication → Sign-in method → Anonymous**.
3. Enable **Authentication → Sign-in method → Email/Password**. Do not enable public application sign-up UI; create organizer users through controlled Firebase Console administration.
4. Create a Realtime Database in the region chosen for the project.
5. Do not start in test mode. Deploy the version-controlled rules only after emulator tests pass and the target project ID has been checked.

No Firebase project, provider, user, claim, database, or Rule is created remotely by repository setup commands.

## 3. Public frontend configuration

Copy `.env.example` to the ignored `.env.local` file and set:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_DATABASE_URL
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_USE_EMULATORS
```

Use `VITE_FIREBASE_USE_EMULATORS=true` only for local emulator work. All six public web-app values are required together. Missing or malformed configuration intentionally produces a polished unconfigured state in the live roster while preserving the static page.

Never place service-account JSON, access tokens, passwords, exact accommodation details, reveal content, protected codes, or private booking information in a `VITE_*` variable. Every `VITE_*` value is compiled into inspectable browser assets.

## 4. Local emulator workflow

Prerequisites are Node.js 20.19 or newer and Java 21 or newer. Start Auth, Realtime Database, and the Emulator UI with the synthetic demo project:

```sh
npm run emulators
```

The configured endpoints are:

- Auth: `127.0.0.1:9099`
- Realtime Database: `127.0.0.1:9000`
- Emulator UI: `127.0.0.1:4000`

In another terminal, run the app with a complete local `.env.local` and `VITE_FIREBASE_USE_EMULATORS=true`. Use only synthetic participants and organizer accounts in the emulator.

Run the isolated Rules suite with:

```sh
npm run test:rules
```

This command starts only the database emulator for `demo-games-and-castles`, runs the permission matrix, and shuts the emulator down. The separate Rules workflow runs the same command in CI. Pages deployment never deploys database rules.

## 5. Organizer provisioning

The organizer UI supports Email/Password sign-in only. Authorization comes exclusively from the server-issued custom claim:

```text
auth.token.admin === true
```

The Admin SDK utility uses Application Default Credentials or `GOOGLE_APPLICATION_CREDENTIALS`; credentials stay outside this repository. Authenticate locally with a suitably restricted administrative identity, verify the target project, then grant by email or UID:

```sh
npm run admin:set-claim -- --email organizer@example.invalid --admin true --project YOUR_PROJECT_ID
npm run admin:set-claim -- --uid FIREBASE_AUTH_UID --admin true --project YOUR_PROJECT_ID
```

Remove the claim without disturbing any other custom claims:

```sh
npm run admin:set-claim -- --uid FIREBASE_AUTH_UID --admin false --project YOUR_PROJECT_ID
```

The user must sign in again or refresh their ID token after a claim change. The script refuses demo project IDs and requires the production/development project ID explicitly. Creating Auth users and deciding who receives organizer access remain controlled console/operations tasks.

The frontend uses separate Firebase app/auth instances for guest and organizer sessions. Signing an organizer in or out therefore does not replace the anonymous guest UID stored in the same browser.

## 6. Database rules deployment

Rules are default-deny and indexes are declared in `database.rules.json`. `database.indexes.json` is a human-review manifest; Realtime Database deploys indexes as part of its Rules document.

After tests pass and only with explicit authorization to modify the chosen remote project:

```sh
npm run deploy:rules -- YOUR_DEVELOPMENT_PROJECT_ID
npm run deploy:rules -- YOUR_PRODUCTION_PROJECT_ID
```

Run only the line for the intended environment. Before deployment, confirm the CLI target printed by Firebase, confirm the project is development or production as intended, and inspect `git diff -- database.rules.json`. Do not deploy from the Pages workflow.

Phases 3–4 add these flat paths to the existing Phase 2 schema:

- `/competitionDrafts/{competitionId}` — organizer read/write; unused drafts may be deleted.
- `/competitions/{competitionId}` — authenticated read; organizer configuration lifecycle plus atomic Merry-Go-Round activate/complete/reopen/reset status transitions; no client delete.
- `/competitionRuns/{competitionId}` — authenticated read; admin-claim create/update, or pre-result deletion only as part of reset. The runtime is restricted to the exact Merry-Go-Round engine and one-step revisions.
- `/audit/{auditId}` — organizer read and create-only append; no update/delete. Phase 4 records activation/draw, match state/results/corrections, tie/bracket dependency events, completion/reopen, and reset without sensitive payloads.

After the revised Rules are deliberately deployed, publish the frontend through the normal Pages workflow. Validate Phase 4 first against the development project with synthetic data: activate, verify a second authenticated browser receives the same persisted draw, enter/correct a result, generate a bracket, complete/reopen, and confirm guest writes fail. A production smoke check should remain non-destructive; do not create or reset a real run merely to test deployment.

## 7. GitHub Pages variables

The production repository has the following Actions variables configured. For a replacement repository or Firebase project, create them in **Repository settings → Secrets and variables → Actions → Variables**:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`

The Pages workflow sets emulator mode to false. The current deployed build receives all six variables and its live participant features are connected to production Firebase. A future build with missing variables would still deploy the static page, but its live participant features would remain unconfigured.

## 8. Identity and recovery limitation

Anonymous guest identity persists in the current browser profile. Clearing site data, using private browsing, or switching browser/device can create a new UID. Phase 2 has no guest identity recovery, cross-device claim, account linking, or display-name-as-proof mechanism. An organizer can add a separate organizer-managed participant, but cannot relink a lost anonymous identity in this phase.
