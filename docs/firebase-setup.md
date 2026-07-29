# Firebase setup and operations

## 1. Phase 2–10 scope

Firebase powers anonymous guest identity, the shared participant roster, organizer email/password authentication, organizer participant management, competition configuration, all three competition runtimes, the Phase 7 championship ledger, the Phase 8 Birthday Vault, and the Phase 9 protected Special Reveal. Phase 10 adds optional staged App Check client initialization, session-scoped organizer Auth, recent-auth Birthday publication, sanitized Operations diagnostics, and trusted local backup/cleanup tools. The static itinerary and all Phase 1 presentation sections continue to render when Firebase is unconfigured or unavailable.

Phases 4–6 store public-safe active/completed competition records and format-discriminated `/competitionRuns/{competitionId}` data. Phase 7 stores one replaceable normalized source per valid active/completed run under `/championshipLedger/competitionSources/{competitionId}`. Phase 8 stores lifecycle state, identity-free receipts, owner-private messages, organizer-only moderation, and sanitized revealed snapshots under `/birthdayVault`. Phase 9 stores owner-private predictions, identity-free receipts, claim-protected public opening/resolution state, and one complete prediction ledger source. The recently reauthenticated reveal-organizer browser performs protected atomic operations; Rules independently enforce authorization, lifecycle, revisions, shape, and bounded values. Phase 10 also requires recent authentication for Birthday reveal/republish. App Check enforcement, the exact accommodation address, analytics, and service-worker behavior remain unimplemented.

> **Production status (28 July 2026):** Phases 2–9 are deployed, production-connected, and production-tested. The production Firebase project and organizer access are provisioned, all six core public Firebase web-configuration values are present as GitHub Actions repository variables, and the deployed GitHub Pages site is successfully connected to Firebase. Phase 10 is complete in the repository; its Rules/frontend/App Check-variable rollout remains a deliberate operator action. This implementation did not deploy Rules, change remote Firebase/GitHub/billing configuration, mutate production data, or publish the frontend.

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
VITE_FIREBASE_APP_CHECK_ENABLED
VITE_FIREBASE_APP_CHECK_SITE_KEY
VITE_FIREBASE_APP_CHECK_PROVIDER
VITE_FIREBASE_APP_CHECK_DEBUG
```

Use `VITE_FIREBASE_USE_EMULATORS=true` only for local emulator work. All six core public web-app values are required together. App Check defaults to disabled; when enabled it also requires the public site key and `enterprise` provider (`recaptcha-enterprise` remains an accepted compatibility alias). `VITE_FIREBASE_APP_CHECK_DEBUG=true` is local-only and makes a production config invalid. Missing or malformed core configuration intentionally produces a polished unconfigured state in the live roster while preserving the static page; App Check misconfiguration is surfaced as a safe Operations diagnostic without claiming enforcement.

Never place service-account JSON, access tokens, passwords, exact accommodation details, reveal content, protected codes, or private booking information in a `VITE_*` variable. Every `VITE_*` value is compiled into inspectable browser assets.

## 4. Local emulator workflow

Prerequisites are Node.js 24 or newer and Java 21 or newer. Install dependencies, then start Auth, Realtime Database, and the Emulator UI with the synthetic demo project:

```sh
npm install
```

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

The Rules command starts only the database emulator for `demo-games-and-castles`, runs the permission matrix, and shuts it down. Automated tests use demo project IDs and cannot touch a real project. The Pages workflow runs all validation but does not deploy database Rules.

## 5. Organizer provisioning

The organizer UI supports Email/Password sign-in only. Authorization comes exclusively from the server-issued custom claim:

```text
auth.token.admin === true
```

The protected reveal workspace additionally requires:

```text
auth.token.specialRevealAdmin === true
```

The Admin SDK utility uses Application Default Credentials or `GOOGLE_APPLICATION_CREDENTIALS`; credentials stay outside this repository. Authenticate locally with a suitably restricted administrative identity, verify the target project, then grant by email or UID:

```sh
npm run admin:set-claim -- --email organizer@example.invalid --admin true --project YOUR_PROJECT_ID --confirm-project YOUR_PROJECT_ID
npm run admin:set-claim -- --uid FIREBASE_AUTH_UID --admin true --project YOUR_PROJECT_ID --confirm-project YOUR_PROJECT_ID
```

Grant the dedicated reveal role only to the designated reveal organizer:

```sh
npm run admin:set-claim -- \
  --email organizer@example.invalid \
  --admin true \
  --special-reveal-admin true \
  --project YOUR_PROJECT_ID \
  --confirm-project YOUR_PROJECT_ID
```

Remove the claim without disturbing any other custom claims:

```sh
npm run admin:set-claim -- --uid FIREBASE_AUTH_UID --admin false --project YOUR_PROJECT_ID --confirm-project YOUR_PROJECT_ID
npm run admin:set-claim -- --uid FIREBASE_AUTH_UID --special-reveal-admin false --project YOUR_PROJECT_ID --confirm-project YOUR_PROJECT_ID
```

The user must sign in again or refresh their ID token after a claim change. The script refuses demo project IDs, requires the exact target twice, verifies the service-account `project_id`, rejects group/other-readable credential files, and warns if credentials are inside the repository. Creating Auth users and deciding who receives organizer access remain controlled console/operations tasks.

The frontend uses separate Firebase app/auth instances for guest and organizer sessions. Guest Auth remains browser-local; organizer Auth uses browser-session persistence plus a 30-minute idle expiry/five-minute warning. Signing an organizer in or out therefore does not replace the anonymous guest UID stored in the same browser.

## 6. Database rules deployment

Rules are default-deny and indexes are declared in `database.rules.json`. `database.indexes.json` is a human-review manifest; Realtime Database deploys indexes as part of its Rules document.

After tests pass and only with explicit authorization to modify the chosen remote project:

```sh
npm run deploy:rules -- YOUR_DEVELOPMENT_PROJECT_ID
npm run deploy:rules -- YOUR_PRODUCTION_PROJECT_ID
```

Run only the line for the intended environment. Before deployment, confirm the CLI target printed by Firebase, confirm the project is development or production as intended, and inspect `git diff -- database.rules.json`. Do not deploy from the Pages workflow.

Phases 3–7 add these flat paths to the existing Phase 2 schema:

- `/competitionDrafts/{competitionId}` — organizer read/write; unused drafts may be deleted.
- `/competitions/{competitionId}` — authenticated read; organizer configuration lifecycle plus atomic Merry-Go-Round, All Hands, or Group Format activate/complete/reopen/reset status transitions; no client delete.
- `/competitionRuns/{competitionId}` — authenticated read; admin-claim create/update, or pre-result deletion only as part of reset. The exact `round-robin-knockout`, `all-hands`, or `group-knockout` format selects a bounded schema with one-step run and result/session revisions, immutable activation state, and strict format-specific validation.
- `/championshipLedger/competitionSources/{competitionId}` — authenticated read, admin-claim full-source replace/remove, with run-revision and format validation.
- `/championshipLedger/manualBonuses/{bonusId}` — organizer-only active/revoked history; no hard deletion.
- `/championshipLedger/manualBonusesPublic/{bonusId}` — authenticated read of sanitized active bonuses only.
- `/audit/{auditId}` — organizer read and create-only append; no update/delete. Phase 7 adds safe source backfill/reconciliation/orphan-removal and bonus create/revoke/restore events.

Phase 8 adds:

- `/birthdayVault/publicState` — authenticated read; organizer-only revisioned lifecycle transitions.
- `/birthdayVault/submissionReceipts/{publicationId}` — authenticated read of sanitized count records; the owner may write only the UUID matching their own message and only atomically with its status.
- `/birthdayVault/privateMessages/{ownerUid}` — owner/admin read; owner-only create/edit/withdraw/resubmit while collecting, with profile/participant linkage and immutable identity.
- `/birthdayVault/moderation/{ownerUid}` — organizer-only read/write, one-step revisions, current message-revision references, private notes, and ordering.
- `/birthdayVault/publishedMessages/{publicationId}` — authenticated read only after reveal; organizer-only sanitized records tied to the current reveal revision.
- `/audit/{auditId}` — adds compact Birthday Vault state/moderation/order/publication actions without message bodies or notes.

Phase 9 adds:

- `/specialReveal/privateConfig` — dual-claim reveal-organizer-only, revisioned configuration; editing freezes after opening.
- `/specialReveal/publicState` — authenticated read and recent dual-claim lifecycle writes.
- `/specialReveal/publicOpening` — authenticated read after opening and recent dual-claim publication.
- `/specialReveal/publicResolution` — authenticated read only after resolution and recent dual-claim publication/correction.
- `/specialReveal/predictions/{ownerUid}` — owner-only read/write while `prediction-open`; a recently reauthenticated dual-claim organizer may enumerate for resolution.
- `/specialReveal/predictionReceipts/{predictionId}` — authenticated identity-free count source coupled atomically to the owner's prediction.
- `/championshipLedger/predictionSources/{eventId}` — authenticated read only after resolution and recent dual-claim complete-source replacement.
- `/audit/{auditId}` — adds neutral configuration, lifecycle, resolution, correction, reconciliation, and local-fallback metadata without passwords, choices, or payload bodies.

After deliberately deploying the Phase 8 Rules and frontend, sign in to Organizer Mode and open **Birthday Vault**. Open submissions only when ready to collect real messages. Rehearse with synthetic emulator data first; do not create production test messages that might be mistaken for guest content. Rules deployment is still separate from Pages deployment and is never performed by the Pages workflow.

## 7. Phase 9 zero-cost deployment and rehearsal

Phase 9 uses only Firebase Authentication and Realtime Database in production. It has no separate server deployment, app-specific reveal credential, billing-account requirement, or custom password-attempt store.

For each environment:

1. Grant `admin: true` and `specialRevealAdmin: true` to the designated organizer with the trusted local script.
2. Sign out and back into Organizer Mode so the new claims reach the ID token.
3. Deploy reviewed Realtime Database Rules:

   ```sh
   npm run deploy:rules -- YOUR_DEVELOPMENT_PROJECT_ID
   npm run deploy:rules -- YOUR_PRODUCTION_PROJECT_ID
   ```

   Run only the command for the intended target.

4. Push the frontend to `master` and verify the Pages workflow.
5. Configure real private content through Organizer Mode only after privacy review.
6. Rehearse opening, prediction isolation, lock/reopen, resolution, correction, reconciliation, and realtime guest/leaderboard updates before the live moment.

Sensitive operations prompt for the currently signed-in Firebase Email/Password credential, force-refresh the token, and must complete within the Rules-enforced five-minute `auth_time` window. The password is cleared before the database operation and is never stored or passed to repository persistence methods. See [Protected Special Reveal](special-reveal.md) for the exact security boundary and emergency local fallback.

After the revised Rules are deliberately deployed, publish the frontend through the normal Pages workflow. In Organizer Mode, open **Championship Desk**, review the preview counts, reconcile each existing valid run (or use **Reconcile all**), then repeat the scan to confirm every supported active/completed run is **In sync**. Reconciliation is idempotent and does not alter results. Test result correction, All Hands void/restore, completion/reopen, bonus revoke/restore, and guest write denial with synthetic development data before production. A production smoke check should remain non-destructive beyond the required ledger backfill.

## 8. GitHub Pages variables

The production repository has the following Actions variables configured. For a replacement repository or Firebase project, create them in **Repository settings → Secrets and variables → Actions → Variables**:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`

Phase 10 additionally maps these public/staging variables. Add them only for an intentional App Check rehearsal; disabled/blank is the safe baseline:

- `VITE_FIREBASE_APP_CHECK_ENABLED`
- `VITE_FIREBASE_APP_CHECK_SITE_KEY`
- `VITE_FIREBASE_APP_CHECK_PROVIDER`

Use `VITE_FIREBASE_APP_CHECK_ENABLED=false` for Stage 1. For an explicitly rehearsed Stage 2 build, use `true`, set `VITE_FIREBASE_APP_CHECK_PROVIDER=enterprise`, and set `VITE_FIREBASE_APP_CHECK_SITE_KEY` to the public web registration key copied from Firebase Console. Leave the site-key variable blank while disabled if preferred. Do not create `VITE_FIREBASE_APP_CHECK_DEBUG` in GitHub; the workflow fixes it to `false`.

The Pages workflow sets emulator mode and App Check debug to false. It also injects commit/ref/time into a public `version.json`. The current deployed build receives all six core variables and its live participant features are connected to production Firebase. A future build with missing core variables would still deploy the static page, but its live participant features would remain unconfigured. App Check variables are not secrets; never store a debug token in them.

## 9. Identity and recovery limitation

Anonymous guest identity persists in the current browser profile. Clearing site data, using private browsing, or switching browser/device can create a new UID. Phase 2 has no guest identity recovery, cross-device claim, account linking, or display-name-as-proof mechanism. An organizer can add a separate organizer-managed participant, but cannot relink a lost anonymous identity in this phase.

## 10. Phase 10 rollout and local operations

Deploy the reviewed Phase 10 Rules separately before relying on recent-auth Birthday publication. Then publish the frontend through the existing `master` Pages workflow. Verify Organizer Mode → **Operations**, the session warning/expiry, Birthday reveal/republish reauthentication, `version.json`, `robots.txt`, and production-subpath assets. This repository does not perform either deployment automatically beyond the normal Pages push workflow.

App Check stays disabled unless an operator deliberately completes the enforcement-off staging procedure in [Security hardening](security-hardening.md). Do not activate a billable API or attach billing for this product. If the preferred provider cannot be configured inside the zero-cost boundary, leave `VITE_FIREBASE_APP_CHECK_ENABLED=false`.

Trusted local backup, inspection, cleanup, incident, and credential instructions are centralized in the [Operations runbook](operations-runbook.md). These commands never belong in CI. Remote commands require `GOOGLE_APPLICATION_CREDENTIALS` outside the repository, mode `600`, a matching credential `project_id`, and `--confirm-project` equal to `--project`. Emulator mode accepts only `demo-*` IDs and uses no production credential.
