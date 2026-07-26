# Implementation roadmap

## 1. Delivery rules

Each phase is a review gate, not only a task list. A phase starts only when its dependencies and decisions are available; it ends only when its measurable acceptance criteria and relevant tests pass. Work that discovers a requirement change updates the Phase 0 documents through review before implementation continues.

Cross-cutting rules:

- Keep game names as user data and use only `round-robin-knockout`, `all-hands`, and `group-knockout` as format identifiers.
- Treat GitHub Pages as static delivery and Firebase as the authenticated state/backend boundary.
- Add no sensitive reveal content, protected codes, exact address, or secrets to repository files, build output, fixtures, screenshots, logs, or client paths.
- Display the complete 31 July–2 August 2026 range and only `Žižkov, Prague 3` as public accommodation information.
- Use separate development and production Firebase projects; develop against the Emulator Suite wherever practical.
- Derive championship totals from score entries. Never introduce a manually incremented total.
- Confirm and persist generated fixture/group draws once; never regenerate on render/reconnect.
- Test from mobile widths and with reduced motion/accessibility tools throughout, not only in Phase 11.

## 2. Phase overview

| Phase | Outcome | Depends on |
|---:|---|---|
| 0 | Frozen implementation-ready specification | Product brief |
| 1 | Static mobile-first visual shell on GitHub Pages | Phase 0 |
| 2 | Secure Firebase/auth/realtime foundation | Phase 1 |
| 3 | Generic competition creator | Phase 2 |
| 4 | Merry-Go-Round vertical slice and round scoring | Phase 3 |
| 5 | All Hands engine | Phases 3–4 shared foundations |
| 6 | Group Format engine | Phases 3–4 shared foundations |
| 7 | Unified championship ledger and leaderboard | Phases 4–6 |
| 8 | Birthday Vault | Phases 2 and 7 presentation foundations |
| 9 | Prediction event and protected special reveal | Phases 2, 7, and 8 presentation patterns |
| 10 | Security hardening | Feature-complete Phases 2–9 |
| 11 | Polish, QA, rehearsal, and production deployment | Phases 1–10 |

## 3. Phase details

### Phase 0 — Documentation and frozen specification

**Goal:** Create one internally consistent, reviewable source of product, rule, data, security, design, and delivery truth before application code.

**Inputs**

- Approved 31 July–2 August 2026 trip range, three-day roles, and Saturday itinerary.
- Planned stack and GitHub Pages/Firebase constraints.
- Known privacy requirement for reveal and accommodation data.

**Outputs**

- Repository README and all documents linked from it.
- Normative competition rules, TypeScript-shaped domain model, Firebase tree, trust model, design tokens, phase gates, and decision register.

**Dependencies:** None beyond organizer review access.

**Acceptance criteria**

1. All eight required Markdown files exist and links resolve.
2. The three exact identifiers and friendly labels are consistent across documents.
3. Table points and championship points are separate; individual round wins award configurable championship points.
4. Prediction scoring is backend-controlled, deterministic, and idempotent.
5. The full trip range, Friday/Saturday/Sunday roles, Saturday itinerary, free-attraction labels, delay strategy, and priority order match the approved brief.
6. Public accommodation copy is `Žižkov, Prague 3`; no application source, scaffolding, credentials, exact address, or sensitive reveal detail exists.
7. Each later phase includes measurable criteria, risks, and tests.

**Main technical risks:** Ambiguous requirements becoming accidental implementation decisions; contradictory terminology; protected information leaking into examples.

**Recommended tests/review:** Link check; identifier/terminology search; forbidden-content review by organizer; itinerary line-by-line comparison; Markdown/Mermaid rendering; acceptance-criteria checklist.

---

### Phase 1 — Static visual shell and GitHub Pages deployment

**Goal:** Prove the information architecture, mobile visual direction, and deployment path without Firebase or interactive competition logic.

**Inputs**

- [Product specification](product-spec.md), [design system](design-system.md), approved imagery/licensing, repository/Pages configuration.

**Outputs**

- React/TypeScript/Vite/Tailwind shell with all one-page section anchors.
- Complete 31 July–2 August 2026 overview: flexible Friday outline, full Saturday itinerary, and Sunday departure/onward-travel summary rendered from non-sensitive static data.
- Public accommodation copy limited to `Žižkov, Prague 3`, with no exact address in source, mock data, or build output.
- Neutral locked placeholders for Birthday Vault and special reveal.
- Static representative championship cards/empty states using synthetic data.
- GitHub Actions build/deploy workflow and GitHub Pages preview/production URL.

**Dependencies:** Phase 0 approved; public repository/deployment ownership decided.

**Acceptance criteria**

1. A clean checkout builds reproducibly and deploys under the repository base path with no broken asset or anchor URLs.
2. 320 px through desktop layouts have no page-level horizontal overflow; the complete date range and Saturday details/priority behavior are exact.
3. Friday communicates no fixed times, Saturday uses a scheduled vertical timeline, and Sunday states only departure and onward travel.
4. Public accommodation copy is exactly `Žižkov, Prague 3`; locked sections are neutral and contain no sensitive clues or exact address.
5. Keyboard navigation, headings, focus, contrast, reduced-motion baseline, and 44 px targets pass an initial audit.
6. No Firebase dependency, credential, application secret, or faux protected content is introduced.

**Main technical risks:** GitHub Pages base-path/SPA refresh behavior; oversized imagery/font performance; visual shell implying unauthorized features are secure; mobile bracket mockup overflow.

**Recommended tests:** Type-check/build; lint if configured without broad formatting; Pages smoke test on direct root and anchors; Lighthouse/mobile performance sample; axe; keyboard/screen-reader spot check; responsive screenshots with synthetic data; old-date-range and accommodation-copy searches; built-output forbidden-data scan.

---

### Phase 2 — Firebase foundation, Authentication, participants, and realtime state

**Implementation status:** Complete, including production operations. The production Firebase project, console providers, initial organizer provisioning, and deployed Rules are in place. All six public Firebase web-configuration values are configured as GitHub Actions repository variables, and the deployed GitHub Pages site is successfully connected to Firebase.

**Goal:** Establish secure identity, role authorization, environment separation, realtime subscriptions, and data/rules foundations before competition features.

**Inputs**

- Phase 1 shell; [data model](data-model.md); [security model](security-model.md); development Firebase project and emulator configuration; organizer sign-in decision.

**Outputs**

- Firebase SDK initialization using public client configuration only.
- Anonymous guest authentication and persistent organizer sign-in.
- Custom-claim authorization provisioning procedure and `auth.token.admin === true` checks.
- Participant create/link/manage flows.
- Realtime connection/offline/reconnect state UI and scoped subscription utilities.
- Default-deny Security Rules and an emulator-tested permission matrix for the Phase 2 participant/profile paths.
- A static-safe unconfigured/error boundary; no trip content was moved into Firebase.

**Dependencies:** Satisfied for Phase 2. Phase 1 is complete, Email/Password was selected for persistent organizer sign-in, and development/production project ownership and initial console provisioning are complete.

**Acceptance criteria**

1. Fresh guest receives an anonymous UID and can explicitly create only the participant owned by that UID; lost sessions are intentionally not recovered in this phase.
2. Non-admin users cannot access organizer participant actions; a verified custom-claim admin can manage active/inactive participant records.
3. Unauthenticated access and all unspecified root reads/writes are denied.
4. Connected clients receive scoped active-participant updates without a refresh.
5. Offline and reconnect banners match the specification and never report unacknowledged admin writes as saved.
6. Development and production config/data are isolated; no service account/private secret enters the bundle.
7. Rules emulator permission matrix passes in CI.

**Main technical risks:** Anonymous session loss/duplicate participants; custom-claim token refresh confusion; overly broad rules; root listeners and bandwidth; emulator/production behavior drift.

**Implemented tests/review:** Rules unit matrix; frontend configuration/error/helper/form tests; same-browser anonymous persistence architecture; claim false/true UI paths; static build and forbidden-content scans; production Pages/Firebase connection smoke check. Broader multi-device rehearsal remains Phase 11 release-hardening work rather than a Phase 2 completion blocker.

---

### Phase 3 — Generic competition creator

**Implementation status:** Complete, deployed, and production-verified. The organizer Competition Studio, five-step wizard, typed configuration domain, realtime scheduled guest cards, revision conflicts, atomic multi-location mutations, safe audit records, default-deny Rules, and emulator/frontend tests are implemented. Phase 3 Rules were deployed through the separately authorized operator process described in [Firebase setup](firebase-setup.md).

**Goal:** Let organizers create a validated, versioned competition configuration independent of game name and format-specific execution UI.

**Inputs**

- Phase 2 auth/data foundation; `Competition`, `FormatConfig`, `ScoringConfig`, participant models; format rules.

**Outputs**

- Organizer-only create/edit wizard covering name, participant-ID selection, exact format identifier, format config, series, and scoring.
- Friendly labels mapped at the presentation boundary.
- Draft validation, summary/review, status transitions, revision conflicts, and audit entries.
- Read-only guest competition cards for published `scheduled` configurations.

**Dependencies:** Satisfied for Phase 3. Phase 2 is complete, organizer authorization is claim-backed, and the Phase 3 configuration bounds/defaults are recorded in the decision register.

**Acceptance criteria**

1. Organizer can save/reopen drafts for each exact format and publish only a valid one; guests cannot create or edit drafts.
2. User-entered names have no effect on engine selection and are validated/sanitized as display data.
3. Invalid participant duplication/count, series, qualifier/group count, scoring, and discriminated config combinations are rejected with field errors.
4. Publishing preserves selected participant IDs; later display-name changes update presentation, while deactivation or missing profiles do not silently alter membership.
5. Concurrent edits against the same revision result in one accepted update and one actionable conflict.
6. Every create/edit/status action has a safe audit record.

**Implemented tests/review:** Pure domain tests cover format unions, series presets, round-robin/knockout/group estimates, validation warnings/errors, participant-reference handling, transforms, sorting, runtime parsing, automatic-group persistence, and stale revisions. Component tests cover explicit draft saving, format-reset confirmation, format-specific forms, duplicate display names, active/inactive participant selection, offline mutation blocking, remote-revision conflicts, publish validation/confirmation, unconfigured Firebase presentation, and scheduled guest-card rendering. The 44-case Rules emulator matrix covers guest/admin access, drafts, atomic publication, revision conflicts, archive/restore, reorder, audit append-only behavior, malformed schemas/references/scoring, and default denial of Phase 4 paths.

**Phase boundary:** `scheduled` means a public configuration with fixtures pending. Phase 3 does not create draws, groups, fixtures, sessions, results, standings, ledger entries, or live scoring controls.

**Main technical risks:** One oversized conditional form; invalid combinations crossing client/server validation; changing config after play; display labels leaking into domain logic.

**Recommended tests:** Schema/unit tests for every union branch and boundary; component/form keyboard tests; admin/guest integration tests; concurrency test; property tests for numeric config validation; audit assertions.

---

### Phase 4 — `round-robin-knockout` engine

**Implementation status:** Complete in the repository. The Merry-Go-Round runtime, organizer Control Room, authenticated realtime guest experience, pure derivations, append-only audit activity, runtime validation, default-deny Rules, domain/frontend tests, and expanded emulator matrix are implemented. Production use requires the separately authorized Phase 4 Rules deployment described in [Firebase setup](firebase-setup.md); this implementation did not deploy Rules or modify remote Firebase data.

**Goal:** Deliver the first complete live competition vertical slice, including series results, standings, knockout progression, and round-based weekend points.

**Inputs**

- Phase 3 creator and frozen Merry-Go-Round rules; participant/config snapshots; Rules-enforced revision and atomic-write foundation.

**Outputs**

- Cryptographically secure shuffle and deterministic circle-method generator with BYE support.
- Rest-aware deterministic match ordering, organizer preview, persisted confirmation, and destructive reset flow.
- Active match queue, single/best-of/first-to result entry and correction.
- Round-robin standings with explainable tiebreak status.
- Configurable qualifier count, seeded knockout, final, optional third place, and dependency invalidation.
- Pure, itemized projected competition-point derivation for `match-win`, `round-win`, and configured participation/qualification/placement awards. No global or persisted score ledger is created before Phase 7.

**Dependencies:** Satisfied for Phase 4. Phase 3 is complete; runtime writes use Rules-enforced compare-and-set revisions and atomic multi-location updates; head-to-head applies only to exact two-person ties, while unresolved cohorts require an explicit audited organizer order.

**Acceptance criteria**

1. For every tested participant count, generated matches equal `n(n-1)/2`, every pair occurs once, odd BYEs produce no match, and generation is deterministic from persisted shuffled order.
2. Preview creates no official public fixtures; confirmation creates one shared order; reload/reconnect does not regenerate.
3. Pre-result reset explicitly deletes the generated run and returns the competition to scheduled after confirmation; after any result, casual whole-run reset is unavailable and correction workflows handle dependencies.
4. Series validation accepts only legitimate terminal results and records round winners.
5. Table standings use table points only; projected competition breakdowns derive the configured match and individual-round points without persisting a Phase 7 ledger.
6. The 2–1 default example yields 4 championship points to the winner and 1 to the loser.
7. Correcting a result produces exactly the same standings and projected point breakdown as clean entry of the corrected result.
8. Six-player top-four flow seeds 1v4 and 2v3 and supports final/optional third place.
9. Upstream knockout correction cannot leave silently inconsistent downstream results.

**Main technical risks:** Pairing/scheduling bugs; conflating rounds and matches; multi-way tiebreak ambiguity; correction fan-out; non-power-of-two brackets; two-admin score entry race.

**Recommended tests:** Generator property tests over even/odd and randomized sizes; golden six-player fixture; scheduling invariant tests; series boundary table; standings/tiebreak fixtures; backend idempotency/rebuild tests; downstream invalidation tests; two-device live play rehearsal; Rules/admin tests.

**Implemented tests/review:** Pure tests cover secure-random injection, participant counts 2/3/4/5/6/7/8/10/16, circle-method invariants, rest-aware ordering, single/best-of/first-to results, standings and unresolved ties, 2/4/6/8-seed brackets, byes, correction cascades, revisions, points, completion, reopen, and Realtime Database serialization normalization. Frontend tests cover activation gating, Control Room access, round-by-round entry, read-only live presentation, odd-field byes, offline/unconfigured/malformed states, and strong reopen confirmation. The 58-case Rules matrix covers runtime read/write roles, activation formats/states, snapshot and match validation, revisions, immutable fixtures, results/corrections, tie/bracket/completion/reopen/reset operations, append-only audit, and denial of deferred paths. Full cross-device rehearsal remains a Phase 11 hardening task.

**Phase boundary:** Only `round-robin-knockout` executes. All Hands, Group Format, the global score ledger, Cloud Functions, App Check enforcement, private-message/prediction/reveal operations, and protected accommodation access remain unimplemented.

---

### Phase 5 — `all-hands` engine

**Goal:** Support simultaneous individual/team sessions with configurable result interpretation and scoring.

**Inputs**

- Phase 3 creator; shared result, revision, audit, and point-derivation primitives from Phase 4; All Hands model and rules.

**Outputs**

- Session creator/history with different participant lists per session.
- `winner-only`, `placement`, `highest-score`, `lowest-score`, and `custom` result modes.
- Placement/winner/participation awards, numeric tiebreaks, custom fields, teams and award-distribution policy.
- Correction/recalculation and format-appropriate standings/session presentation.

**Dependencies:** Phases 3–4 shared revision, point derivation, audit, and score-entry presentation foundations. Phase 5 must not create the cross-competition ledger reserved for Phase 7.

**Acceptance criteria**

1. All five exact result modes save valid results and reject invalid/ambiguous shapes.
2. Sessions independently snapshot entrants/teams and can use different lists.
3. Highest/lowest direction, placement ties, winner bonuses, and custom awards follow the frozen config and remain explainable.
4. Each participant appears at most once per individual/team session; team awards expand using the declared policy.
5. Multiple repeated sessions produce distinct deterministic entries; correction replaces only the affected session entries.
6. Progress/penalty/placement custom data can model the specified generic use case without a hard-coded game name.

**Main technical risks:** Arbitrary custom mode becoming unvalidateable; tied placement semantics; team point multiplication; treating numeric game scores as championship points accidentally.

**Recommended tests:** Result-schema unit matrix; team membership property tests; highest/lowest/tie golden cases; variable roster integration; repeated session/idempotency tests; correction rebuild equality; accessible result-entry tests.

---

### Phase 6 — `group-knockout` engine

**Goal:** Add balanced randomized groups, group round robins, qualification, and cross-group knockout.

**Inputs**

- Phase 3 creator; Phase 4 generator/match/standings/bracket primitives; Group Format rules.

**Outputs**

- Automatic recommended and validated manual group counts.
- Secure balanced group draw, organizer preview/confirmation, persisted draw and fixtures.
- Single/double group round robins, group standings/tiebreaks, qualification mapping, cross-group bracket.
- Explicit destructive reset and downstream invalidation/reseeding flow.

**Dependencies:** Phase 4 pairing, standings, bracket, revision, reset, and point-derivation foundations. The persisted global ledger remains Phase 7 work.

**Acceptance criteria**

1. Every participant is assigned exactly once; group sizes differ by at most one for all tested valid configurations.
2. Recommended 4–16 participant group counts match the specification; manual invalid counts are rejected.
3. Each group has exact internal pairings once or twice according to leg count; draw persists only after confirmation.
4. Six participants default to two groups of three, top two qualify, and semifinals cross A1–B2/B1–A2.
5. Changing a confirmed draw requires impact review and clears/archives all affected group, knockout, standing, and ledger data.
6. A qualifier-changing correction presents and safely invalidates dependent bracket results.

**Main technical risks:** Uneven/empty group edge cases; double-round duplicate identity; cross-group seed mapping; correction after knockout start; over-reusing round-robin assumptions.

**Recommended tests:** Assignment property tests across counts/groups; fixture properties per group/leg; golden six-player flow; preview persistence test; qualification/tie tests; destructive reset and downstream correction integration; multi-device group draw presentation.

---

### Phase 7 — Overall championship ledger and leaderboard

**Goal:** Turn the Phase 4 per-run point projection into the first persisted, weekend-wide, explainable scoring ledger for all competitions and prediction events.

**Inputs**

- Result sources from Phases 4–6; score model/idempotency keys; design patterns for leaderboard/podium/activity.

**Outputs**

- Trusted derivation registry for all source types.
- Authoritative active/void score-entry ledger; rebuild/reconciliation administrative operation.
- Derived leaderboard cache/index, tied ranks, podium, full ranking, recent activity, per-participant and per-competition breakdown.
- Admin bonus/correction workflow with mandatory reason and audit.
- Presentation-safe score reasons and empty/loading/offline states.

**Dependencies:** Phase 4 result and point-derivation foundation; Phases 5–6 result adapters for complete coverage.

**Acceptance criteria**

1. Every displayed total equals the sum of active ledger entries and no total is client editable.
2. Every point shown has participant, source type/entity, points, reason, timestamp, and deterministic key where required.
3. Replaying any derivation or rebuilding from sources produces no duplicate and the same totals.
4. Result correction removes/voids obsolete entries and adds/upserts expected ones; recent activity does not misrepresent a duplicate award.
5. Equal totals display tied rankings consistently; podium and full list have accessible alternatives.
6. Queries remain scoped/bounded and update two connected clients in realtime.
7. Reconciliation reports missing, extra, or revision-stale entries before applying an audited repair.

**Main technical risks:** Denormalized cache drift; duplicate triggers; large/broad queries; misleading correction activity; score reason exposing private event data.

**Recommended tests:** Pure derivation golden/property tests; idempotency/retry/failure-injection; full clean rebuild vs incremental equality; cache reconciliation; ties; query/index performance with representative volume; accessible breakdown; multi-device updates.

---

### Phase 8 — Birthday Vault

**Goal:** Deliver a private guestbook whose submissions remain unreadable to other guests until an organizer publishes an approved snapshot.

**Inputs**

- Phase 2 identity/functions/rules; Phase 7 realtime/presentation foundations; Birthday Vault model and locked/reveal design.

**Outputs**

- Validated/rate-limited guest submission and confirmation flow.
- Backend-maintained public message count without public submission reads.
- Organizer moderation, hide, close/reopen, ordering, and approved publication.
- Separate published snapshot path and full-screen replayable presentation.

**Dependencies:** Phase 2; content limits/retention and anonymous display policy confirmed; presentation shell.

**Acceptance criteria**

1. Guest can submit permitted fields and sees confirmation/count; a guest cannot enumerate or read another submission by direct SDK/REST access.
2. Organizer can read and moderate private submissions; guests cannot set moderation fields.
3. Hidden/pending entries never appear in the published snapshot.
4. Anonymous-display publication omits/replaces identifying display fields as specified.
5. Publication updates connected clients once, has a stable `publicationId`, and produces an audit entry.
6. Replay runs locally without republishing, changing timestamps, or duplicating data.
7. Rate, field length, unknown-field, and injection tests pass; presentation is keyboard/reduced-motion accessible.

**Main technical risks:** Rules query misconception leaking the collection; unsafe rich text/XSS; count manipulation; anonymous preference not honored; publication race while moderation changes.

**Recommended tests:** Rules/emulator enumeration attempts; callable rate/schema tests; sanitization/XSS cases; publication snapshot golden test; concurrency/expected revision; replay network-write assertion; screen-reader/presentation tests.

---

### Phase 9 — Prediction event and protected special reveal

**Goal:** Support one private neutral prediction per participant, backend-only reveal authorization/publication, and idempotent championship scoring.

**Inputs**

- Phase 2 auth/functions/rules; Phase 7 ledger; Phase 8 locked/reveal presentation pattern; server-side protected configuration provisioned out of band.

**Outputs**

- Dynamic safe labels with stored values only `option-a`/`option-b`.
- Owner-scoped prediction create/update while open and organizer-controlled lock.
- Callable protected reveal operation with admin claim, App Check hook, protected condition, rate limit, revision/request idempotency, publication, resolution, scoring, and audit.
- Realtime neutral locked/published states, optional post-reveal aggregate, full-screen local replay.

**Dependencies:** Phases 2 and 7; protected code/condition provisioning and label/privacy policy; Secret Manager IAM; organizer runbook.

**Acceptance criteria**

1. A linked participant has at most one prediction and can replace it only while the event is `open`; private choices cannot be enumerated by another guest.
2. The lock transition atomically prevents later writes, including stale/offline retries.
3. Non-admin, invalid-condition, unlocked-event, invalid-App-Check (when enforced), and rate-limited reveal attempts make no public/ledger mutation.
4. Successful call publishes only reviewed data, resolves predictions backend-side, and awards configured points (default 3) to correct selections.
5. Each correct participant has at most one `prediction:{eventId}:{participantId}` logical score key; repeated same/new request IDs cannot duplicate points.
6. Incorrect selections award 0 and cannot receive a stale/duplicate score.
7. Connected clients update without refresh; replay makes no backend write.
8. Repository, source maps, database export of public paths, logs, analytics, test fixtures, screenshots, names, and docs contain no protected prepublication content or code.

**Main technical risks:** Secret leakage through build/log/error/metadata; resolving client-side; non-atomic partial publication; brute-force protected code; stale predictions crossing lock; duplicate trigger scoring.

**Recommended tests:** Rules privacy matrix; callable auth/admin/App Check/state/schema tests; rate-limit tests; idempotent retry and injected partial failure; concurrent lock/update/reveal; deterministic score assertion; public export/build/log forbidden-data scan; full multi-device rehearsal using neutral synthetic payloads.

---

### Phase 10 — Security hardening

**Goal:** Turn feature-level controls into a reviewed production security posture with enforced abuse protections, environment isolation, and recovery.

**Inputs**

- Feature-complete data paths/functions/rules; threat model; representative traffic; production Firebase project.

**Outputs**

- Complete least-privilege Rules and emulator suite; App Check monitoring then enforcement.
- Final per-function rate limits, quotas, budget/abuse alerts, Secret Manager IAM, logging redaction.
- Dependency/action review, production Auth/domain configuration, data retention/deletion procedure.
- Backup/export/restore runbook, admin provisioning/revocation runbook, incident/reveal recovery checklist.
- Automated client-build/public-database sensitive-data scan.

**Dependencies:** Phases 2–9 complete; production ownership and monitoring contacts.

**Acceptance criteria**

1. Security matrix passes against emulators and a production-like staging project with root default deny.
2. App Check is enforced on intended products/functions after legitimate-device monitoring shows readiness.
3. Direct REST/SDK bypass attempts cannot perform an action meant for a callable function.
4. Admin claim lifecycle, least-privilege function service accounts, Secret Manager access, allowed domains, and logging redaction are independently reviewed.
5. Rate limits and budget alerts trigger in controlled tests without blocking the rehearsed normal flow.
6. Backup restoration to an isolated project is demonstrated and reconciles source results/ledger.
7. Exact address and protected reveal content remain absent from every public/client artifact and unauthorized response.

**Main technical risks:** App Check blocking legitimate weekend devices; IAM overprivilege; false confidence in Firebase client config secrecy; rate limits too strict/loose; backups containing sensitive data without controls.

**Recommended tests:** Adversarial Rules tests; direct REST bypass; token replay/revocation; App Check valid/invalid; rate/abuse load; dependency/action audit; IAM review; log inspection; backup restore drill; OWASP-style client input/XSS review.

---

### Phase 11 — Animation polish, accessibility, multi-device QA, rehearsal, and production deployment

**Goal:** Make the complete system delightful and dependable under real weekend conditions, then release through a rehearsed process.

**Inputs**

- Phases 1–10; final approved copy/assets/safe labels; target phones/browsers; travel/competition rehearsal scenarios.

**Outputs**

- Purposeful motion, bracket progression, group draw, count-up, podium/vault presentation, controlled confetti, optional sound off by default.
- Complete reduced-motion and accessible equivalents.
- Performance tuning, error/offline/conflict polish, multi-device test report.
- Organizer operating guide, data backup, rollback plan, final GitHub Pages and production Firebase deployment.

**Dependencies:** All feature/security phases; organizer availability for rehearsal; production secrets/data provisioned out of band.

**Acceptance criteria**

1. Critical guest and organizer journeys pass on representative iOS Safari, Android Chrome, and desktop presentation browser with multiple simultaneous clients.
2. WCAG AA-oriented audit passes agreed gates: keyboard, focus, headings, labels/errors, screen reader, contrast, reflow, touch targets, accessible bracket/timeline, and live-region restraint.
3. Reduced motion removes nonessential movement; sound remains off by default; animations never block score entry/navigation and replay never mutates data.
4. Offline/reconnect, stale admin revision, function retry, partial failure recovery, and backup/rollback are rehearsed.
5. Initial load and realtime bandwidth meet agreed mobile budgets; listeners are scoped and cleaned up.
6. Complete Friday, Saturday, Sunday departure summary, all three competition formats, birthday publication, prediction lock/reveal, ledger correction, and presentation runbook succeeds with synthetic protected content.
7. Production deploy uses reviewed commit/artifacts, green CI, enforced Rules/App Check plan, backup, and a documented rollback point.
8. A final scan confirms no sensitive content, protected code, exact address, credentials, or unintended source maps/public data.

**Main technical risks:** Late animation regressions; effects replaying on reconnect; venue connectivity; device sleep/anonymous session loss; production-only configuration drift; an unrehearsed organizer correction during live play.

**Recommended tests:** End-to-end multi-browser/mobile suite; physical-device and poor-network testing; axe plus manual screen-reader/keyboard audit; reduced motion/sound tests; performance budgets; 2–3 organizer concurrency rehearsal; full weekend dry run; deploy/rollback and restore drill; final privacy scan.

## 4. Recommended first vertical slice

After the Firebase foundation and generic creator, prioritize `round-robin-knockout`. It exercises almost every difficult shared concern early: secure/persisted generation, head-to-head series, live result entry, standings, tiebreaks, bracket progression, point derivation, corrections, audit, and multi-device updates. All Hands can then reuse result/point-derivation infrastructure, while Group Format can reuse pairing, standings, and bracket primitives. The cross-competition ledger and its idempotency model remain Phase 7 work.

This order is an architecture decision, not permission to hard-code the engine to any named game.

## 5. Production readiness gate

Production use is blocked until all of the following are true:

- Phase 0 changes and all open security/product decisions marked production-blocking are approved.
- Security Rules, callable authorization/idempotency, and privacy tests pass.
- Organizer accounts/claims are provisioned and revocation is rehearsed.
- Protected configuration and any restricted trip data are provisioned only out of band.
- A current database backup exists and restore/rollback instructions are available offline to organizers.
- At least one complete multi-device rehearsal includes result correction, prediction lock, reveal retry, reduced motion, and temporary network loss.
