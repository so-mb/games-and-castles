# Pre-event checklist

## Repository and deployment

- [ ] Reviewed commit is on `master`; worktree and `git diff --check` are clean.
- [ ] Format check, lint, typecheck, all frontend/domain tests, Rules emulator tests, production dependency audit, security scan, and production build pass.
- [ ] `dist/version.json`, `dist/robots.txt`, repository-subpath assets, and no-source-map policy are verified.
- [ ] GitHub Pages reports the reviewed commit and the app shows no unexpected update banner.
- [ ] No Firebase/Rules/App Check/billing change was bundled into the Pages deploy unintentionally.

## Firebase and authorization

- [ ] Production project ID and six core Pages variables are correct.
- [ ] Anonymous and Email/Password Auth flows work on representative devices.
- [ ] Organizer claims are limited; only the designated reveal organizer has `specialRevealAdmin`.
- [ ] Organizer sign-out leaves guest identity active; browser restart ends the organizer session.
- [ ] Thirty-minute idle expiry and five-minute warning are rehearsed in a shortened test configuration/unit test, not by changing production constants.
- [ ] Birthday reveal/republish and Special Reveal sensitive operations reject wrong/stale credentials and succeed after valid reauthentication.
- [ ] Operations reports expected connection, claims, sync states, project, build, and no quarantined records.

## App Check

- [ ] App Check setting is intentionally disabled or staged; it is never assumed from browser status.
- [ ] Debug mode is false in production and no debug token is stored in GitHub/source.
- [ ] If staged, guest and organizer token availability is checked across event devices while enforcement remains off.
- [ ] Any future enforcement has an explicit rollback/recovery decision and verified zero-cost eligibility.

## Data and privacy

- [ ] Exact accommodation address, private contact/booking data, credentials, and protected reveal data are absent from source, tracked files, `dist`, diagnostics, docs examples, and logs.
- [ ] An encrypted mode-`600` backup has been created, inspected with the correct passphrase, and stored outside the repository.
- [ ] Backup project ID/date/counts are recorded without copying private payloads.
- [ ] If a synthetic-data reset is required, its dry-run account list has been reviewed and the reset is completed before any real participant joins; never use it as post-event cleanup.
- [ ] The [privacy and retention plan](privacy-retention.md) and cleanup owner/date are agreed.
- [ ] Offline access to this runbook and the recovery contact path is available to organizers.

## Device rehearsal

- [ ] 320, 360, 390, 768, 1024, and 1440 px layouts have no page-level horizontal overflow.
- [ ] Keyboard navigation, visible focus, modals, tab workspaces, update banner, and reduced motion are usable.
- [ ] Reconnect/stale-state behavior is rehearsed across at least two devices/tabs.
- [ ] Competition correction/reconciliation, Birthday publication, prediction lock/reopen, resolution/correction, and leaderboard updates have been rehearsed with synthetic development data.
- [ ] No production test content can be mistaken for a real birthday message, prediction, or reveal.
