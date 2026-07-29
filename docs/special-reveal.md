# Protected Special Reveal

## Status and boundary

Phase 9 is implemented, deployed, and production-tested. Its production architecture is browser-first and stays within GitHub Pages, Firebase Authentication, Realtime Database, and Realtime Database Security Rules. It requires no billing account or paid Firebase feature. Phase 10 adds optional staged App Check, organizer session expiry, encrypted backup, and post-event cleanup without changing the dual-claim/recent-auth boundary.

This document uses neutral terminology only. The repository contains no actual reveal payload, actual option labels, correct outcome, organizer password, service-account credential, App Check debug token, or app-specific reveal code. App Check enforcement remains an optional future operator decision; Phase 10 defines private-source retention/cleanup. Load/alert tuning remains future work.

## Trust model

Organizer Mode is the normal control surface. Private configuration and lifecycle controls require both custom claims:

```text
admin === true
specialRevealAdmin === true
```

Opening, lock, reopen, resolution, correction, reconciliation, private-prediction enumeration, and public/ledger publication additionally require a Firebase ID token whose `auth_time` is no more than five minutes old. Before each sensitive action the organizer re-enters the password for the currently signed-in Email/Password account. The client calls Firebase `reauthenticateWithCredential`, force-refreshes the ID token, verifies both claims and `auth_time`, clears the password from React state, and only then executes one authorized database mutation. A typed action phrase protects against accidental clicks but is not authentication or a secret.

Rules independently require both claims and recent `auth_time`. Private configuration editing requires both claims but does not require recent authentication; configuration freezes when public state exists. Ordinary admins cannot read private configuration or enumerate predictions and do not see the reveal workspace.

## Two-stage lifecycle

Absence of public state renders the neutral locked card.

```text
locked
  └─ recent-auth open ─→ prediction-open
       ├─ recent-auth lock ─→ prediction-locked
       │    ├─ recent-auth reopen ─→ prediction-open
       │    └─ recent-auth resolve ─→ resolved
       └─ owner submit/update/withdraw while open only

resolved
  ├─ recent-auth correction ─→ resolved at a new resolution revision
  └─ recent-auth reconciliation ─→ resolved with repaired/no-op ledger source
```

Opening publishes only the reviewed opening payload, prompt, and dynamic option labels. Resolution publishes only the chosen resolution payload, selected option/label, configured points, and identity-free aggregate. The unused resolution payload remains private. Predictions stay immutable after resolution; replay is presentation-only and writes nothing.

## Firebase paths and access

| Path | Access | Purpose |
|---|---|---|
| `/specialReveal/privateConfig` | Dual-claim reveal organizer before opening | Both reviewed variants, prompt, labels, scoring, revisions |
| `/specialReveal/publicState` | Authenticated read; recent dual-claim write | Lifecycle and revision source |
| `/specialReveal/publicOpening` | Authenticated read after opening; recent dual-claim publish | Sanitized opening copy and labels |
| `/specialReveal/publicResolution` | Authenticated read when resolved; recent dual-claim replace | Selected result and identity-free aggregate |
| `/specialReveal/predictions/{ownerUid}` | Owner read/write while open; recent dual-claim collection read | One private neutral selection per linked participant |
| `/specialReveal/predictionReceipts/{predictionId}` | Authenticated read; matching owner atomic write | Identity-free active count; no selection or identity |
| `/championshipLedger/predictionSources/{eventId}` | Authenticated read when resolved; recent dual-claim replace | Complete deterministic prediction scoring source |
| `/audit/{auditId}` | Organizer read; bounded append-only writes | Neutral, payload-free operation metadata |

The organizer UI shows counts and validation summaries rather than casually listing individual choices. Before resolution, a guest can read only their own selection and identity-free receipts. The option distribution becomes public only in the final resolution.

## Private configuration and inspection boundary

The reveal organizer configures an opaque event ID, opening copy/motif, prompt, two dynamic labels, two possible resolution payloads, and 1–100 correct-prediction points. There is no stored preselected correct outcome. Developer fixtures use only `option-a` and `option-b`.

The application bundle necessarily exposes the procedure, path names, schemas, action phrases, and scoring algorithm. It does not expose configured content because that data remains behind claim-restricted Rules. The privileged reveal-admin browser can read private configuration and predictions; a compromised account or unlocked organizer laptop can therefore perform reveal operations. Password reauthentication and the five-minute Rules window reduce session-theft and unattended-device risk, but this browser model is not equivalent to a private server. There is no trustworthy app-specific browser secret and no custom client-side security rate limiter; Firebase Authentication supplies password verification and its platform abuse protections.

## Atomic browser operations

Platform-neutral domain helpers validate revisions and derive complete root updates. The browser repository reads the current authoritative state immediately after reauthentication and calls one root-level `update`:

- Opening writes `publicOpening`, revision-1 `publicState`, and neutral audit together.
- Lock/reopen writes the one-step state transition and audit together.
- Resolution writes `publicResolution`, resolved `publicState`, the complete prediction source, and audit together.
- Correction replaces the resolution and complete source, increments state and resolution revisions, and audits the replacement.
- Reconciliation recalculates the complete source and writes only when missing or stale; a matching source is a no-op.

The organizer browser performs aggregate computation because Rules cannot practically recompute an arbitrary collection aggregate. Rules still enforce authorization, recent authentication, legal state transitions, one-step revisions, event/revision relationships, strict shapes, configured point bounds, deterministic entry structure where maintainable, and append-only neutral audit. Success appears only after Firebase confirms the atomic write.

## Prediction ownership and scoring

One UID-keyed prediction belongs to the linked active participant and stores only `option-a` or `option-b`. Create, update, resubmit, or withdraw uses one atomic update with its identity-free receipt and one-step revision. Rules re-read public state, profile linkage, participant ownership/status, immutable IDs, and the matching receipt, so stale/offline writes cannot cross the lock boundary.

Resolution includes only valid submitted predictions still linked to active participants. Each correct participant receives one deterministic entry derived from `prediction:{eventId}:{participantId}` with `sourceType` `prediction-correct`; incorrect and withdrawn predictions receive no entry. The source is a complete replacement containing event ID, state and resolution revisions, stable fingerprint, entry count, and schema version. Correction removes obsolete winners, repeated calculation cannot append duplicate points, and existing subscriptions update the public resolution, championship leaderboard, participant detail, and `Prediction Master` achievement in realtime.

## Claim provisioning

Run the trusted Admin SDK claim script from a credentialed local terminal. It preserves unrelated claims and prints no credential or token:

```sh
npm run admin:set-claim -- \
  --email organizer@example.com \
  --admin true \
  --special-reveal-admin true \
  --project YOUR_PROJECT_ID

npm run admin:set-claim -- \
  --email organizer@example.com \
  --special-reveal-admin false \
  --project YOUR_PROJECT_ID
```

After any change, sign out/in or force-refresh the organizer token.

## Emergency local fallback

Organizer Mode is primary. A trusted local Admin SDK tool is available only for recovery from the organizer laptop:

```sh
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/outside/repository.json \
npm run reveal:admin-local -- --project YOUR_PROJECT_ID
```

Add `--dry-run` to suppress all writes. The interactive menu can inspect state, preview a resolution, open, lock, reopen, resolve, correct, or reconcile. It displays the exact target, prompts for the option instead of placing it in shell history, requires `APPLY` or `PREVIEW`, reuses the browser's domain calculations, performs the same atomic updates, emits neutral fallback audit metadata, and prints only sanitized counts/fingerprints. Never put the service-account file in this repository. The script is not run by CI or deployment.

For a neutral emulator rehearsal:

```sh
npm run emulators
npm run reveal:admin-local -- \
  --project demo-games-and-castles \
  --emulator \
  --dry-run
```

## Deployment and rehearsal

No server deployment, verifier provisioning, or billing setup is required.

1. Add `admin: true` and `specialRevealAdmin: true` to the designated organizer.
2. Sign out and back into Organizer Mode.
3. Deploy reviewed Realtime Database Rules:

   ```sh
   npm run deploy:rules -- YOUR_PROJECT_ID
   ```

4. Push the frontend to `master` and verify the Pages workflow.
5. Configure the real private content through Organizer Mode only after privacy review.
6. Rehearse privately with the designated account and at least one guest device.
7. Do not open the production event until the intended moment.

During rehearsal verify an ordinary admin is denied, wrong-password and expired-auth attempts make no mutation, the password is cleared, private predictions remain isolated, lock/reopen works, resolution updates another browser and leaderboard, correction replaces points, reconciliation becomes a no-op once synchronized, and reduced-motion/keyboard behavior remains usable.

## Phase 9 limitations

- Production deployment is complete; final live multi-device rehearsal remains an operator/Phase 11 task.
- App Check enforcement, abuse/load tuning, alerting, and automated restore remain future explicit work; Phase 10 implements enforcement-off staging, dependency hardening, encrypted local backup/inspection, and bounded cleanup.
- There is no custom failed-password limiter beyond Firebase Authentication's platform protections.
- Predictions, receipts, and the unselected private configuration are removed within seven days after the trip after a verified encrypted backup; public resolution and deterministic scoring history remain.
- One current Special Reveal is supported; this is not an archived multi-event CMS.
- Private rehearsal is a local visual preview, not an authorization test.
- Anonymous guest identity remains browser-local with no recovery or cross-device claim flow.
- The exact accommodation address and protected trip retrieval remain unimplemented.
