# Privacy and retention

## Policy

Collect only the event data required for roster ownership, competition operation, birthday publication, prediction resolution, and audit/recovery. Never place exact accommodation data, credentials, passwords, tokens, booking references, or protected content in static assets, diagnostics, audit summaries, or public examples.

Private Birthday Vault and Special Reveal source data is retained only through the weekend and the short correction/recovery window. The confirmed operational default is to run the encrypted backup and private cleanup within seven days after 2 August 2026, once the organizer confirms that publication, scoring, and corrections are final.

## Cleanup scope

The trusted cleanup tool removes:

- `/birthdayVault/privateMessages`
- `/birthdayVault/moderation`
- `/birthdayVault/submissionReceipts`
- `/specialReveal/privateConfig`
- `/specialReveal/predictions`
- `/specialReveal/predictionReceipts`

It preserves public/published Birthday Vault messages, public Special Reveal opening/state/resolution, competition runs/history, championship competition/prediction sources, manual bonus history/projection, participant records, and safe audit metadata. It does not delete Firebase Auth users or attempt guest identity recovery. Any later participant/Auth deletion request requires a separate identity/reference review.

Anonymous Auth users are not deleted automatically. A post-event operator may inspect aggregate anonymous-account counts in Firebase Console, but deletion remains a separate manual decision because participant ownership uses `ownerUid`. Deleting those accounts can remove the owners' ability to edit their participant record without removing the public participant history. Persistent Email/Password organizers must never be included in a bulk anonymous cleanup, and owner references must not be silently cleared.

## Backup retention

Before cleanup, create and authenticate an encrypted backup outside the repository. Keep the backup only for the correction/recovery period: 30 days after cleanup by default, then remove it from all operator devices/copies. A legal, safety, or active incident hold may extend this period only when recorded by the organizer. Passphrases are shared out of band and never saved beside the file.

The backup contains encrypted RTDB data and Auth metadata, so encryption does not make it non-sensitive. Limit filesystem/cloud access, use mode `600`, avoid consumer sync folders unless their access is explicitly reviewed, and never commit or attach `.gac-backup` files to issues/tasks.

## Public and audit retention

Public-safe event results and published snapshots may remain for the trip archive until the organizer requests archival/removal. Audit entries contain safe action/revision metadata only and may remain for 90 days after cleanup for incident/recovery explanation, then should be reviewed for deletion. The repository does not automate that later audit removal because it requires a deliberate referential and operational review.

## Privacy requests and exceptions

A private-source deletion request may be completed earlier after a fresh encrypted backup and review of published copies. Deleting private source does not automatically remove an already published Birthday message or public result; redaction/unpublication is a separate audited operation. Do not claim that `robots.txt`, `noindex`, authentication, or encryption erases data from devices that legitimately rendered or copied it.
