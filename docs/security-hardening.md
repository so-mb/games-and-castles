# Phase 10 security hardening

## Status and boundary

Phase 10 is complete in the repository. It changes browser behavior, Realtime Database Rules, CI validation, and trusted local operator tooling. It did not deploy the frontend or Rules, change remote Firebase/GitHub settings, create a cloud resource, enable App Check enforcement, attach billing, or write production data. Phase 11 has not started.

The product remains a public GitHub Pages bundle backed only by Firebase Authentication and Realtime Database. Client code, Firebase web configuration, App Check site keys, requests, and UI procedures remain inspectable. Authorization still comes from Auth claims, recent password authentication, lifecycle/revision checks, strict Rules, and default denial.

## App Check staging

The default is `VITE_FIREBASE_APP_CHECK_ENABLED=false`. When enabled with a valid site key, both the default guest Firebase app and the named organizer app initialize `ReCaptchaEnterpriseProvider` before their Auth/Database clients are obtained. Initialization is HMR-safe. Operations reports provider, debug flag, per-client initialization/token availability, and `enforcement: unknown`; it never returns or copies a token.

Misconfiguration is contained:

- missing site key or unsupported provider produces an `invalid` diagnostic instead of breaking the static page;
- token failure produces a degraded diagnostic while enforcement remains staged off;
- debug mode is rejected in production and while App Check is disabled;
- a debug token is never committed, stored in a Vite variable, or copied into diagnostics;
- enforcement is a Firebase Console setting and cannot be inferred from browser code.

Firebase recommends reCAPTCHA Enterprise for new web integrations, but assessments beyond its no-cost quota can be billed. Therefore this repository does not enable the provider remotely or enforce it automatically. An operator may stage it only if Firebase Console setup is available without billing/paid API activation and legitimate-device monitoring remains within the zero-cost boundary. Otherwise it stays disabled. Authentication and Rules remain the security boundary either way.

## Organizer sessions and sensitive actions

- Guest Auth retains browser-local persistence.
- Organizer Auth uses browser-session persistence, so it does not intentionally survive closing the tab/browser session.
- Organizer Mode signs out after 30 minutes without pointer, keyboard, touch, focus, or cross-tab activity. A blocking warning appears for the final five minutes with **Stay signed in** and **Sign out now** controls.
- A `BroadcastChannel` shares activity and expiry signals across open tabs where supported. Browser session-storage behavior and suspended/background tabs vary, so this is practical coordination rather than a distributed lock.
- Organizer sign-out never signs out the anonymous guest Firebase app.
- Special Reveal keeps its dual-claim five-minute recent-auth boundary.
- Birthday Vault reveal and republish now require the current organizer password, a force-refreshed token, a one-action authorization no older than one minute, and a Rules-visible `auth_time` no older than five minutes. The password is cleared before database reads/writes.

## Realtime Database Rules audit

Phase 10 reviewed every `.read` and `.write` boundary in `database.rules.json` rather than only new paths.

| Area | Read boundary | Write boundary | Phase 10 conclusion |
|---|---|---|---|
| Participants/profile | authenticated safe roster; owner/admin detail | owner-limited or admin, immutable identity | retained |
| Competition config/runtime | authenticated public-safe data; drafts admin-only | admin claim, exact lifecycle/revision/schema | retained |
| Championship | authenticated sanitized sources; private bonuses admin-only | admin claim; dual-claim recent auth for prediction source | retained |
| Birthday Vault | state/receipts authenticated; messages owner/admin; moderation admin | owner while collecting; admin moderation; recent admin auth for reveal/republish | strengthened |
| Special Reveal | owner/public lifecycle boundaries; private config/predictions dual-claim recent auth | dual claim, recent auth, exact atomic state/source relationships | retained |
| Audit | admin read | create-only authorized action; no update/delete | retained |
| Unspecified paths | denied | denied | retained |

The emulator suite covers unauthenticated access, owner isolation, ordinary-admin denial, missing/false claims, recent and expired `auth_time`, stale revisions, partial and unknown shapes, atomic publication, append-only audit, and default-deny regressions. Phase 10 adds stale Birthday Vault publication denial. Admin SDK cleanup is deliberately outside client Rules and requires local credential/project/backup safeguards.

## Browser and supply-chain controls

- `noindex, nofollow, noarchive`, `Referrer-Policy: no-referrer`, and `robots.txt` reduce accidental discovery and outbound referrer disclosure. They are advisory metadata, not access control.
- Production source maps remain disabled.
- `version.json` contains only schema version, commit/ref, and build time and is polled while visible every five minutes. It contains no environment values.
- Official Actions are pinned to verified full commit SHAs, with major tags retained in comments for Dependabot.
- Dependabot checks npm and official Actions weekly and groups minor/patch updates.
- `npm run security:audit` runs the production dependency audit and the repository/artifact scanner.
- `npm run security:check` is the CI/local aggregate alias for that audit.
- `npm run security:scan` scans tracked and untracked non-ignored repository text plus `dist` for high-confidence credential formats, sensitive local/backup files, distributable debug mode, and ignored local banned terms. It reports locations, not local sensitive terms.

## CSP assessment

A Content Security Policy was assessed but deliberately deferred. GitHub Pages cannot set repository-specific response headers, while a meta CSP would need to account for Firebase Auth/RTDB connections, WebSockets, reCAPTCHA Enterprise scripts/frames, and emulator development. Shipping an unverified broad policy would add little protection; shipping a narrow policy could block guest/organizer access or App Check on event devices. Phase 11 may add a tested CSP after the final provider/domain set is known. Existing output encoding, React text rendering, strict schemas, no rich HTML, no source maps, and referrer/indexing controls remain active.

## Zero-cost exclusions

No Blaze upgrade, billing account, Cloud Functions, Firestore, Storage, Cloud Scheduler, paid Maps/API, Analytics, remote restore service, or automated App Check enforcement was added. No secret, debug token, exact accommodation address, or reveal payload belongs in repository/config/build diagnostics.
