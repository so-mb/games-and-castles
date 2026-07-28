# Championship ledger and reconciliation

## Status and boundary

Phase 7 is complete, deployed, production-connected, and reconciled. The instructions below remain the operator runbook for a replacement environment or future source repair. Phase 8 implements Birthday Vault independently. Phase 9 now adds backend-owned prediction scoring and Special Reveal correction/reconciliation in the repository; production rollout remains manual. App Check and a final championship lock remain outside this phase.

## Persisted paths

```text
/championshipLedger/competitionSources/{competitionId}/meta
/championshipLedger/competitionSources/{competitionId}/entries/{entryId}
/championshipLedger/manualBonuses/{bonusId}
/championshipLedger/manualBonusesPublic/{bonusId}
/championshipLedger/predictionSources/{eventId}/meta
/championshipLedger/predictionSources/{eventId}/entries/{entryId}
/audit/{auditId}
```

`competitionSources` and the active-only bonus projection are readable by authenticated guests. A prediction source becomes authenticated-readable only when its matching Special Reveal state is `resolved`. The complete bonus history is organizer-only, while prediction-source writes are Admin SDK-only. No mutable participant total, rank, recent-feed copy, or leaderboard cache is persisted.

## Prediction normalization

Resolution filters to submitted predictions whose owner/profile/active-participant linkage is still valid. Each correct selection maps to one `prediction-correct` entry with a deterministic ID and logical source identity `prediction:{eventId}:{participantId}`; incorrect or withdrawn selections map to no entry. The source fingerprint covers event/state/resolution identity and stable sorted entries, with award time fixed to the published resolution timestamp.

Resolution and correction replace the complete prediction source in the same root transaction as public state/resolution and audit metadata. Reconciliation derives that source again from authoritative resolved data, verifies both metadata and the complete entry map, repairs damage when needed, and becomes a no-op once matched. No client can edit an individual prediction award.

## Competition normalization

`deriveCompetitionLedgerSnapshot` dispatches by exact runtime format and reuses the existing point projection for Merry-Go-Round, All Hands, or Group Format. It maps engine categories into a bounded generic award union, omits zero awards, and rejects incompatible competition/runtime pairs. Voided sessions, cleared results, reset knockouts, and reopened final placements therefore disappear from the next complete snapshot naturally.

Entry IDs are deterministic hashes of competition ID, participant ID, normalized award type, source entity ID, and the optional award discriminator. Names and random push IDs are never used. The source fingerprint hashes the authoritative run revision, canonical frozen scoring configuration, competition status, and stable sorted normalized entries. Metadata also records the run revision explicitly for Rules validation and organizer display.

## Synchronization and correction

Every application runtime mutation derives the complete next source and includes it in the same Realtime Database root update as the next run and audit events. Completion/reopen also updates competition status; pre-result reset removes both the runtime and source. Replacement is source-wide, so retries cannot append duplicates and corrections cannot retain obsolete awards.

Competition-derived entries have no direct edit repository or UI. Correct the authoritative match, session, tie, qualification, or completion state instead.

## Championship Sync

Championship Desk compares current published competitions, valid runs, and persisted sources. Each record is classified as **In sync**, **Missing source**, **Stale source**, **Orphaned source**, **Malformed run**, **Malformed source**, **Unsupported state**, or **No ledger expected**.

Reconcile-one and reconcile-all re-read revisions, derive from the authoritative runtime, replace the full source, and append safe audit metadata. Running reconciliation twice produces no additional write when revision and fingerprint already match. Orphan removal rechecks that no active/completed runtime is valid and requires confirmation.

After deploying Phase 7 Rules and the Pages build:

1. Sign in to Organizer Mode.
2. Open **Championship Desk**.
3. Review missing, stale, malformed, and orphaned counts.
4. Reconcile one source for each format and verify the expected entry delta.
5. Use **Reconcile all** for remaining valid sources.
6. Repeat the scan; supported active/completed runs should be **In sync**.
7. Review public totals and participant explanations before awarding a manual bonus.

## Manual bonuses

Bonuses are positive integer awards from 1–100 points with a required plain-text label up to 80 characters and optional note up to 280. Creation uses a push ID to prevent overwriting another award. Revoke and restore advance the revision, reject stale clients, update/remove the public projection atomically, and append audit events. Private bonus records cannot be hard-deleted. Negative adjustments and editing competition-derived entries are not supported.

## Derived views

The global table sums valid current competition entries, active bonuses, and valid resolved prediction entries. It includes active zero-point participants, inactive participants with historical points, and safe placeholders for missing participant records. Equal totals use shared competition ranks (`1, 1, 3`) with no hidden tiebreak. Participant detail exposes competition, bonus, and prediction subtotals; source contributions, latest current awards, and score-neutral achievements are rebuilt from the same inputs. `Prediction Master` is derived from a current correct-prediction entry and adds no points itself.

Malformed records are quarantined. Missing, stale, malformed, or unsupported expected sources produce a public verification warning rather than being presented as final. “Latest scoring awards” describes current ledger entries, not an immutable history.
