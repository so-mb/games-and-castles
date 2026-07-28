# Protected Special Reveal

## Status and boundary

Phase 9 is complete in the repository and validated against synthetic emulator data. Production verifier provisioning and Functions, Realtime Database Rules, and frontend deployment remain deliberate operator actions. No remote Firebase resource was modified during implementation.

This document uses neutral terminology only. The repository contains no actual reveal payload, actual option labels, correct outcome, protected organizer code, or verifier. App Check enforcement, general retention/deletion automation, load/alert tuning, and broader abuse hardening remain Phase 10 work.

## Two-stage lifecycle

The event begins with no public state, which renders a neutral locked card. An organizer creates the private configuration before opening; configuration freezes when the backend creates public state.

```text
unopened
  └─ openSpecialReveal ─→ prediction-open
       ├─ lockPredictionEvent ─→ prediction-locked
       │    ├─ reopenPredictionEvent ─→ prediction-open
       │    └─ resolveSpecialReveal ─→ resolved
       └─ guest submit/update/withdraw prediction while open only

resolved
  ├─ correctSpecialRevealResolution ─→ resolved at a new revision
  └─ reconcilePredictionLedger ─→ resolved with repaired/no-op ledger source
```

Opening publishes only the reviewed opening payload, prompt, and dynamic option labels. Resolution publishes only the selected resolution payload, correct option/label, configured points, and identity-free aggregate. The unselected resolution payload is never copied to a public path. Predictions remain locked after resolution and after correction.

## Firebase paths and access

| Path | Client access | Purpose |
|---|---|---|
| `/specialReveal/privateConfig` | Organizer read/write before opening only | Both reviewed variants, prompt, labels, scoring, revisions |
| `/specialReveal/publicState` | Authenticated read; backend write | `prediction-open`, `prediction-locked`, or `resolved` lifecycle |
| `/specialReveal/publicOpening` | Authenticated read after opening; backend write | Selected public opening copy and labels |
| `/specialReveal/publicResolution` | Authenticated read only when resolved; backend write | Selected public result and identity-free aggregate |
| `/specialReveal/predictions/{ownerUid}` | Owner read/write while open; backend read | One private neutral selection per linked participant |
| `/specialReveal/predictionReceipts/{predictionId}` | Authenticated read; matching owner atomic write | Identity-free active count source; no selection or participant identity |
| `/specialReveal/privateSecurity/attempts/{organizerUid}` | No client access | Persistent failed-code window and lockout |
| `/championshipLedger/predictionSources/{eventId}` | Authenticated read only when resolved; backend write | Complete deterministic prediction scoring source |
| `/audit/{auditId}` | Organizer read; bounded organizer create or backend write | Neutral, payload-free operation metadata |

The organizer UI deliberately does not expose individual predictions. Before resolution, a guest can read only their own selection plus the identity-free receipt collection. The active total may be displayed, but the option distribution becomes public only with the final resolution.

## Private configuration

The organizer configures one opaque event ID, opening copy/motif, prediction prompt, two dynamic labels, two possible resolution payloads, and 1–100 correct-prediction points. Rules enforce a strict schema, immutable event/creation metadata, one-step revisions, and the no-public-state editing boundary. Labels and payloads must be content-reviewed before entry. Developer data continues to use only `option-a` and `option-b`.

Private rehearsal renders both possible flows entirely in local React state. It makes no Firebase write and does not authorize or resolve the event.

## Callable Functions

The Node.js 24 TypeScript Functions v2 codebase lives under `functions/`, runs in `europe-west1`, uses the Admin SDK, and exports:

- `openSpecialReveal` — verifies the protected code, creates revision 1 state, and publishes the opening.
- `lockPredictionEvent` — advances an open event to locked.
- `reopenPredictionEvent` — advances a locked event back to open.
- `resolveSpecialReveal` — verifies the code and locked/config revisions, then atomically publishes the selected resolution, resolved state, complete prediction source, and audit record.
- `correctSpecialRevealResolution` — requires the exact non-secret confirmation `CORRECT RESULT`, protected code, and current state/resolution revisions; atomically replaces the selected resolution and complete source.
- `reconcilePredictionLedger` — rebuilds the expected source from authoritative resolved data without changing public resolution; a matching source is a no-op.

Every callable requires Firebase Authentication and `auth.token.admin === true`. Requests use exact allowlisted keys and bounded values. The client receives generic actionable errors, never backend stacks, database paths, submitted codes, verifier details, or unselected payloads. App Check is intentionally configured but unenforced until the Phase 10 monitoring rollout.

## Protected-code verification and rate limiting

The secret name is `SPECIAL_REVEAL_CODE_VERIFIER`. The local provisioning utility prompts twice without echo, rejects weak values, creates a unique random salt, derives a versioned `scrypt$v1$…` verifier using Node crypto, and streams only that verifier to Firebase CLI over stdin. It prints neither the code nor verifier and saves neither to disk.

Verification parses the versioned parameters and uses a timing-safe derived-key comparison. Failed verification is tracked per organizer UID under the backend-only security path. Five failures inside 15 minutes produce a 15-minute lockout; successful verification clears the record. A compact neutral audit event records the lockout without the attempted code.

Provision separately for each non-demo environment from an interactive trusted terminal:

```sh
npm run reveal:set-code -- --project YOUR_DEVELOPMENT_PROJECT_ID
npm run reveal:set-code -- --project YOUR_PRODUCTION_PROJECT_ID
```

The command prints the target and requires the operator to retype its project ID. Do not run it in CI, store the input in shell history, or put the raw code/verifier in GitHub variables, Vite variables, `.env` files, Realtime Database, screenshots, or chat.

## Prediction ownership and scoring

One UID-keyed prediction belongs to the linked active participant and stores only `option-a` or `option-b`. Create, update, resubmit, or withdraw uses one root atomic update with its receipt and a one-step revision. Rules re-read current public state, user profile, participant ownership/status, immutable identity, and the matching receipt, so a stale/offline write cannot cross the lock boundary.

On resolution the backend filters to valid submitted predictions still linked to active participants. Each correct participant receives one deterministic entry whose logical source identity is `prediction:{eventId}:{participantId}` and whose `sourceType` is `prediction-correct`. Incorrect or withdrawn predictions produce no entry. The complete `/championshipLedger/predictionSources/{eventId}` source replaces atomically with public resolution/state, so retry and correction cannot append duplicate points.

The global leaderboard validates and merges competition sources, active public bonuses, and resolved prediction sources. Participant detail shows a separate prediction subtotal, and the score-neutral `Prediction Master` achievement derives from a current correct-prediction entry. No mutable participant total is persisted.

The source fingerprint covers the event/state/resolution identity and stable sorted entries. Award timestamps derive from the published resolution timestamp, so reconciliation is deterministic. Reconciliation also compares the complete entry map and revision metadata rather than trusting a stored fingerprint; it repairs missing/damaged content and becomes a no-op once the source matches.

## Local validation

Install both dependency trees, then run:

```sh
npm install
npm --prefix functions install
npm run functions:build
npm run test:functions
npm run test:functions:integration
npm run test:rules
```

`npm run emulators` starts Auth (`9099`), Realtime Database (`9000`), Functions (`5001`), and the Emulator UI (`4000`) for `demo-games-and-castles`. The integration wrapper creates a random synthetic code and verifier for that run, writes an ignored mode-`0600` Functions emulator secret file, and removes it in `finally`. It never touches a real Firebase project.

The emulator rehearsal should cover organizer/non-organizer calls, opening, guest own/other prediction access, lock/stale write rejection, reopen, resolution, retry, correction, damaged-source repair, repeated reconciliation, and persistent lockout. Browser rehearsal should use neutral synthetic content only.

## Manual deployment runbook

Cloud Functions deployment requires the Firebase project to use the pay-as-you-go Blaze plan; enabling billing is a manual owner decision and this repository does not change it. See Firebase's official [Cloud Functions deployment guide](https://firebase.google.com/docs/functions/get-started#deploy-functions-to-a-production-environment).

For each environment, deploy in this order:

1. Configure the verifier secret.
2. Deploy the Phase 9 Functions codebase.
3. Deploy Realtime Database Rules.
4. Deploy the frontend through the existing Pages workflow.

Development:

```sh
npm run reveal:set-code -- --project YOUR_DEVELOPMENT_PROJECT_ID
npm run deploy:functions -- YOUR_DEVELOPMENT_PROJECT_ID
npm run deploy:rules -- YOUR_DEVELOPMENT_PROJECT_ID
```

Production:

```sh
npm run reveal:set-code -- --project YOUR_PRODUCTION_PROJECT_ID
npm run deploy:functions -- YOUR_PRODUCTION_PROJECT_ID
npm run deploy:rules -- YOUR_PRODUCTION_PROJECT_ID
```

The Firebase CLI may prompt to enable required Google Cloud APIs and configure Artifact Registry cleanup. Review the target project and each prompt; do not enable billing/APIs or change IAM automatically. Functions need access to the named secret through the deployment-managed service identity. The Pages workflow validates the Functions build and unit suite but never deploys Functions or Rules and never stores the reveal verifier.

After deployment, publish the reviewed frontend from `master`, sign in with an authorized organizer, verify the **Special Reveal** workspace, and rehearse non-destructively in development. In production, configure real content only after privacy review; opening is a live irreversible publication boundary for configuration, so confirm state, labels, payload variants, scoring, and the selected project first.

## Phase 9 limitations

- Production deployment and live multi-device validation are not performed by repository implementation.
- App Check enforcement, abuse/load tuning, alerting, backup/restore, IAM review, and dependency hardening remain Phase 10.
- Predictions and receipts are retained after resolution; deletion/anonymization periods remain the unresolved general retention decision.
- The implementation supports one current Special Reveal event, not an archived multi-event CMS.
- Private rehearsal is a visual local preview, not a security or backend test.
- Anonymous guest identity remains browser-local with no recovery or cross-device claim flow.
- The exact accommodation address and protected trip retrieval remain unimplemented.
