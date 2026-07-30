# Operations runbook

## Before using production

Use the [pre-event checklist](pre-event-checklist.md). Work from a reviewed commit with green format, lint, typecheck, frontend/domain, Rules, security-scan, audit, and production-build results. Never run trusted local scripts from CI or a GitHub Pages browser.

Open **Organizer Mode → Operations** after sign-in. The tab is visible to every authorized organizer and is lazy-loaded. It shows only sanitized build, Firebase project, connection, claim-presence, organizer-session, App Check availability, feature synchronization, and quarantined-record counts. It does not show UIDs, email addresses, tokens, private messages, predictions, reveal content, passwords, exact accommodation details, or database payloads.

Use:

- **Refresh diagnostics** to refresh runtime signals and fetch `/games-and-castles/version.json` without cache;
- **Copy diagnostics** to copy the sanitized object for incident handoff;
- **Competition Studio**, **Championship Desk**, **Birthday Vault**, and (for reveal admins) **Special Reveal** to continue the rehearsal in the relevant workspace;
- **Open deployed app** to compare the active tab with the Pages origin;
- **Sign out Organizer Mode** before handing a device to another person.

## App Check rollout

### Stage 1 — Client disabled

Keep `VITE_FIREBASE_APP_CHECK_ENABLED=false`. No App Check token is required and the existing Auth/Rules boundary remains active.

### Stage 2 — Client enabled, enforcement off

If Firebase Console permits no-billing reCAPTCHA Enterprise registration, create the web registration manually, add only its public site key as a repository variable, set the provider to `enterprise`, and deploy. Never add a debug token to GitHub. Leave enforcement off. Verify token availability and normal guest, incognito, mobile, organizer sign-in, Birthday Vault, competition, championship, and Special Reveal flows. Monitor Firebase App Check request metrics manually. If legitimate traffic is not reliably attested or setup requires billing, set the enabled variable back to false.

### Stage 3 — Realtime Database enforcement

Only after a successful monitoring period, a separate authorized operator may enable Realtime Database enforcement manually in Firebase Console. Immediately repeat participant, competition, ledger, Birthday Vault, and Special Reveal smoke tests. If legitimate requests fail, disable enforcement manually and return to Stage 2; no code or Rules rollback is required for that switch.

### Stage 4 — Authentication enforcement

Treat Authentication enforcement as an independent optional decision. Do not enable it until anonymous sign-in, organizer Email/Password sign-in, password reauthentication, incognito, mobile, and recovery/rollback have all passed. Confirm the setup stays inside the zero-payment boundary. Phase 10 configures neither Stage 3 nor Stage 4 remotely.

Local debug mode is permitted only in an ignored `.env.local`, with `VITE_FIREBASE_APP_CHECK_DEBUG=true`. Firebase prints a browser-local debug token for manual Console registration. Treat it as a secret, never paste it into source/docs/issues, and revoke it after testing.

## Encrypted backup

Store `GOOGLE_APPLICATION_CREDENTIALS` outside the repository with mode `600`. The credential JSON project ID must exactly match the target, and every remote command requires `--confirm-project` with the same ID.

Preview without writing a file:

```sh
npm run backup:create -- \
  --project YOUR_PROJECT_ID \
  --confirm-project YOUR_PROJECT_ID \
  --database-url YOUR_DATABASE_URL \
  --output ../games-and-castles-2026.gac-backup \
  --dry-run
```

Create an encrypted file by removing `--dry-run`. The command refuses an output path inside the repository, prompts twice without echo, requires at least 12 characters, encrypts the in-memory RTDB snapshot plus sanitized Auth metadata using scrypt and AES-256-GCM, and creates a new mode-`600` file. It never writes plaintext. Auth exports exclude password hashes and access/refresh tokens.

Inspect and authenticate a backup without writing plaintext:

```sh
npm run backup:inspect -- --input ../games-and-castles-2026.gac-backup
```

The default output is envelope metadata and record counts. A wrong passphrase, modified tag/ciphertext, malformed envelope, old file, or wrong project fails closed. There is intentionally no automated restore command in Phase 10: restoring would overwrite live state and requires a separately reviewed, target-specific recovery plan.

## Pre-participant project reset

Use this only before real participants join, when synthetic rehearsal data and anonymous emulator/production guest accounts must be removed. It is intentionally broader than post-event private cleanup.

Preview is the default. Both project arguments are required and must match exactly, including in emulator mode:

```sh
npm run ops:reset-project -- \
  --project YOUR_PROJECT_ID \
  --confirm-project YOUR_PROJECT_ID \
  --database-url YOUR_DATABASE_URL
```

The dry-run report shows only sanitized Realtime Database branch/direct-record counts and Auth category counts. It lists non-anonymous, non-organizer Auth accounts by email/UID/provider so the operator can review them; those accounts are never deleted automatically.

Apply only after creating and authenticating a matching encrypted backup less than 24 hours old:

```sh
npm run ops:reset-project -- \
  --project YOUR_PROJECT_ID \
  --confirm-project YOUR_PROJECT_ID \
  --database-url YOUR_DATABASE_URL \
  --backup /path/to/recent-backup.gac-backup \
  --apply
```

The passphrase is requested without echo. After backup authentication and the sanitized preview, the operator must type `RESET YOUR_PROJECT_ID`. Apply mode removes the complete Realtime Database root and every anonymous Firebase Auth user. It preserves all Email/Password organizers and their complete custom-claim objects, and it leaves every other persistent Auth account unchanged. Repeating the command is safe: an empty database and zero anonymous accounts remain empty.

The command refuses every detected CI environment. It does not read or modify Database Rules, Auth-provider configuration, App Check, GitHub, billing, or any Firebase project setting, and it is never part of a workflow. It uses the same mode-`600` credential/project verification as the other trusted Admin SDK tools.

For a synthetic emulator rehearsal, start `npm run emulators` in one terminal. Then connect the reset command to those Auth and Database emulators using only a `demo-*` project ID:

```sh
npm run ops:reset-project -- \
  --project demo-games-and-castles \
  --confirm-project demo-games-and-castles \
  --emulator
```

The manual integration suite starts both emulators, exercises deletion/preservation/idempotence against synthetic data, and shuts them down:

```sh
npm run test:ops:reset-emulator
```

This suite is local-only and is deliberately absent from GitHub Actions.

## Post-event private cleanup

Preview is the default and performs no write:

```sh
npm run privacy:cleanup -- \
  --project YOUR_PROJECT_ID \
  --confirm-project YOUR_PROJECT_ID \
  --database-url YOUR_DATABASE_URL
```

Apply only after creating and verifying a backup less than 24 hours old:

```sh
npm run privacy:cleanup -- \
  --project YOUR_PROJECT_ID \
  --confirm-project YOUR_PROJECT_ID \
  --database-url YOUR_DATABASE_URL \
  --apply \
  --backup ../games-and-castles-2026.gac-backup
```

The tool decrypts the supplied backup in memory, verifies its project, displays path counts, and requires the exact typed phrase `PURGE PRIVATE DATA`. One root update removes only the documented private Birthday Vault and Special Reveal branches and appends safe audit metadata. It preserves published birthday messages, public reveal state/resolution, competition history, championship sources/leaderboard derivations, participants, and audit. Re-running after a successful purge is a no-op with no extra audit entry.

## Incident response

1. Stop sensitive organizer operations; do not repeatedly retry stale writes.
2. Copy Operations diagnostics and note the visible time/action. Do not copy browser storage, private database payloads, or passwords.
3. Confirm connectivity, project ID, deployed commit, organizer claim state, session warning, and feature sync/quarantine counts.
4. Reload only after saving or abandoning local form input. Use the update banner when a newer commit is deployed.
5. For an account/device concern, sign out Organizer Mode, revoke or correct claims through the trusted local process, and force a new sign-in. Guest anonymous identity remains separate.
6. For Rules or data concerns, reproduce with synthetic emulator data first. Remote Rules/data changes, rollback, App Check enforcement, and restore require explicit authorization.
7. Record only safe metadata in incident notes; never include credentials, private messages/predictions, unselected reveal payloads, or exact accommodation details.
