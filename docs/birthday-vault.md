# Birthday Vault

## Status and boundary

Phase 8 is implemented, deployed, and production-tested. Phase 10 strengthens reveal and republish with current-password reauthentication plus a Rules-enforced five-minute `auth_time` window, and defines encrypted backup/private cleanup. Phase 9 implements prediction processing and the protected Special Reveal separately.

The Birthday Vault is a private digital guestbook, not a cryptographic vault. Firebase Authentication identifies owners and organizers, while default-deny Realtime Database Rules enforce access and data shape. Other guests do not download private message content or moderation. The bounded publication operation is Rules-authorized because it contains no hidden outcome or protected payload.

## Lifecycle

No persisted state means unopened. An organizer may create `collecting`, move `collecting → closed`, reopen with `closed → collecting`, or reveal with `closed → revealed`. After reveal, only `revealed → revealed` republish is valid. Reopen, relock, unpublish, and un-reveal are not implemented.

Every state mutation advances `revision`. Reveal and republish also advance `revealRevision`. Organizer controls are disabled offline and stale revisions are rejected.

## Data paths

```text
/birthdayVault/publicState
/birthdayVault/submissionReceipts/{publicationId}
/birthdayVault/privateMessages/{ownerUid}
/birthdayVault/moderation/{ownerUid}
/birthdayVault/publishedMessages/{publicationId}
/audit/{auditId}
```

- `publicState` is authenticated-readable and organizer-writable.
- Receipts contain only an opaque UUID, active flag, timestamp, and schema version. They support the public count without revealing identity or content.
- A private message is keyed by its owner UID and readable only by that owner or an organizer.
- Moderation is organizer-only and references an exact message revision. A later guest edit leaves the old record intact but stale.
- Published messages are authenticated-readable only after reveal and are keyed by the opaque UUID.
- Anonymous published records omit owner UID, participant ID, and avatar identity. Named records contain only a publication-time participant display snapshot.

## Operations

Guest submit, edit, withdraw, and resubmit operations atomically update the owner-private message and matching receipt. The participant profile must link to the authenticated UID; the participant must be active on initial submission. A publication UUID is created with `crypto.randomUUID()` once and remains immutable.

Organizers approve or hide the current message revision, maintain an optional private note, and use keyboard-accessible earlier/later ordering. Pending, stale-approved, malformed, and withdrawn messages cannot enter the approved publication set. Hidden and withdrawn messages do not block reveal.

Reveal readiness requires a closed vault, at least one current approved message, no submitted pending/stale messages, valid unique publication IDs, valid content, available named participant snapshots, an online organizer, and a current admin claim/revision. Reveal and republish additionally require the current Firebase organizer password, a force-refreshed token, and Rules-visible `auth_time` no older than five minutes. The password clears before database access. The confirmation phrase `REVEAL` is accidental-action protection, not authentication.

Reveal and republish use one root-level atomic update to replace the entire published set, advance public state, and append safe audit metadata. Private message text and moderation notes are never copied to audit. Replay, next/previous, autoplay, pause, and close are local presentation state and make no Firebase write.

## Validation and limits

- Message: required, trimmed, plain text, 5–1,200 characters; intentional line breaks preserved.
- Title: optional plain text, at most 60 characters.
- Emoji: optional allowlisted key only.
- Display: exactly `named` or `anonymous`.
- Moderation note: optional private plain text, at most 280 characters.
- Every mutable record uses one-step revisions and allowlisted fields.
- Malformed private, receipt, moderation, or published records are quarantined; one invalid record does not crash the page, and organizer publication is blocked.

The emulator suite contains 53 focused Phase 8 cases in addition to all existing participant, competition, runtime, ledger, bonus, audit, and default-deny regressions.

See [Privacy and retention](privacy-retention.md) for the confirmed seven-day private-source cleanup window and [Operations](operations-runbook.md) for encrypted backup/cleanup commands.
