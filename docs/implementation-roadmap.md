# Implementation roadmap

## 1. Delivery rules

Each phase is a review gate, not only a task list. A phase starts only when its dependencies and decisions are available; it ends only when its measurable acceptance criteria and relevant tests pass. Work that discovers a requirement change updates the Phase 0 documents through review before implementation continues.

Cross-cutting rules:

- Keep game names as user data and use only `round-robin-knockout`, `all-hands`, and `group-knockout` as format identifiers.
- Treat GitHub Pages as static delivery and Firebase Authentication/Realtime Database/Rules as the shared-state and authorization boundary.
- Add no sensitive reveal content, organizer passwords, exact address, or credentials to repository files, build output, fixtures, screenshots, logs, or client paths.
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
4. Prediction scoring uses deterministic complete-source replacement and is idempotent.
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

**Implementation status:** Complete, deployed, and production-tested. The Merry-Go-Round runtime, organizer Control Room, authenticated realtime guest experience, pure derivations, append-only audit activity, runtime validation, default-deny Rules, domain/frontend tests, and expanded emulator matrix are implemented. Phase 4 Rules were deployed through the separately authorized operator process described in [Firebase setup](firebase-setup.md).

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

**Recommended tests:** Generator property tests over even/odd and randomized sizes; golden six-player fixture; scheduling invariant tests; series boundary table; standings/tiebreak fixtures; idempotency/rebuild tests; downstream invalidation tests; two-device live play rehearsal; Rules/admin tests.

**Implemented tests/review:** Pure tests cover secure-random injection, participant counts 2/3/4/5/6/7/8/10/16, circle-method invariants, rest-aware ordering, single/best-of/first-to results, standings and unresolved ties, 2/4/6/8-seed brackets, byes, correction cascades, revisions, points, completion, reopen, and Realtime Database serialization normalization. Frontend tests cover activation gating, Control Room access, round-by-round entry, read-only live presentation, odd-field byes, offline/unconfigured/malformed states, and strong reopen confirmation. The 58-case Rules matrix covers runtime read/write roles, activation formats/states, snapshot and match validation, revisions, immutable fixtures, results/corrections, tie/bracket/completion/reopen/reset operations, append-only audit, and denial of deferred paths. Full cross-device rehearsal remains a Phase 11 hardening task.

**Phase 4 boundary at completion:** Only `round-robin-knockout` executed at this gate. Phase 5 subsequently adds All Hands; Group Format, the global score ledger, App Check enforcement, private-message/prediction/reveal operations, and protected accommodation access remain unimplemented.

---

### Phase 5 — `all-hands` engine

**Implementation status:** Complete, deployed, and production-tested. The format-discriminated All Hands runtime, frozen activation snapshot, organizer All Hands Table, authenticated realtime guest experience, five result modes, individual/team sessions, pure standings and projected-point derivation, corrections, void/restore, final tie resolution, completion/reopen/reset workflows, append-only audit activity, runtime quarantine, default-deny Rules, domain/frontend tests, and expanded emulator matrix are implemented. Phase 5 Rules were deployed through the separately authorized operator process described in [Firebase setup](firebase-setup.md).

**Goal:** Support simultaneous individual/team sessions with configurable result interpretation and scoring.

**Inputs**

- Phase 3 creator; shared result, revision, audit, and point-derivation primitives from Phase 4; All Hands model and rules.

**Outputs**

- Session creator/history with different participant lists per session.
- `winner-only`, `placement`, `highest-score`, `lowest-score`, and `custom` result modes.
- Placement/winner/participation awards, generic primary/secondary metric tiebreaks, bounded custom point allocation, teams, and `each-member` award distribution.
- Fixed and open-ended session plans, accessible final tie ordering, final placement snapshots, correction/recalculation, void/restore, and format-appropriate standings/session presentation.
- Revision-safe atomic writes with audit entries and authenticated guest subscriptions to the same `/competitionRuns/{competitionId}` source of truth.

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

**Implemented tests/review:** Pure tests cover activation/config freezing, participant subsets, team membership and award expansion, all five result modes, shared/manual placements, opposite metric directions, secondary tiebreaks, decimals, permitted negative scores, custom bounds, repeated sessions, corrections, void/restore, fixed/open-ended completion, final tie ordering, completion/reopen, point breakdowns, and RTDB serialization quarantine. Frontend tests cover activation routing and frozen configuration while the shared competition regressions cover offline, malformed-runtime, public-read-only, Merry-Go-Round, and Group Format boundaries. The 65-case Rules matrix adds All Hands activation, session/result validation, correction, void/restore, atomic completion/reopen, immutable snapshots, and guest-write denial while preserving the complete Merry-Go-Round matrix. Full cross-device and production All Hands rehearsal remains a Phase 11 hardening task.

**Phase 5 boundary at completion:** `round-robin-knockout` and `all-hands` executed at this gate. Phase 6 subsequently adds Group Format; the global score ledger, App Check enforcement, private-message/prediction/reveal operations, and protected accommodation access remain unimplemented.

---

### Phase 6 — `group-knockout` engine

**Implementation status:** Complete, deployed, and production-tested. Group Format has a frozen format-discriminated runtime, secure draw confirmation, group/seed decisions, qualification, knockout, correction/reset/completion/reopen workflows, realtime guest presentation, audit activity, and default-deny Rules. Phase 7 now consumes its existing itemized point projection without changing Group Format scoring.

**Goal:** Add balanced randomized groups, group round robins, qualification, and cross-group knockout.

**Inputs**

- Phase 3 creator; Phase 4 generator/match/standings/bracket primitives; Group Format rules.

**Outputs**

- Automatic recommended and validated manual group counts.
- Secure balanced group draw, organizer preview/confirmation, persisted draw and fixtures.
- Single/double group round robins, group standings/tiebreaks, qualification mapping, cross-group bracket.
- Explicit pre-result reset, complete knockout invalidation after qualifier-changing corrections, and branch-safe knockout correction flow.
- Mobile-friendly organizer/public draw, fixture, standings, qualification, bracket, completion, and itemized projected-point views.

**Dependencies:** Phase 4 pairing, standings, bracket, revision, reset, and point-derivation foundations. Phase 7 reuses the completed point projection.

**Acceptance criteria**

1. Every participant is assigned exactly once; group sizes differ by at most one for all tested valid configurations.
2. Recommended 4–16 participant group counts match the specification; manual invalid counts are rejected.
3. Each group has exact internal pairings once or twice according to leg count; draw persists only after confirmation.
4. Six participants default to two groups of three, top two qualify, and semifinals cross A1–B2/B1–A2.
5. A confirmed draw can be replaced only through the pre-result reset; the runtime and its derived standings/projected points are removed atomically while the Phase 3 configuration returns to scheduled.
6. A qualifier-changing correction presents and safely invalidates dependent bracket results.

**Main technical risks:** Uneven/empty group edge cases; double-round duplicate identity; cross-group seed mapping; correction after knockout start; over-reusing round-robin assumptions.

**Recommended tests:** Assignment property tests across counts/groups; fixture properties per group/leg; golden six-player flow; preview persistence test; qualification/tie tests; destructive reset and downstream correction integration; multi-device group draw presentation.

**Implemented tests/review:** Pure tests cover all automatic group-count boundaries, valid/invalid manual counts, injected deterministic shuffle, balanced assignments, group sizes 2–6 across one/two legs, reversed second-leg sides, interleaving, standings and exact-two head-to-head handling, explicit fingerprinted group/cross-group ties, qualification snapshots, normalized rank tiers, deterministic lower-tier rematch avoidance, golden A1–B2/B1–A2 pairings, BYEs, corrections, full-knockout invalidation, completion/reopen, points, and strict parser quarantine. Frontend tests cover the exact activation-preview handoff, Group Arena routing, persisted public draw/fixture/standings/points views, and guest read-only behavior. The 73-case emulator Rules matrix preserves all Phase 2–5 cases and adds Group activation/draw/group/result/qualification/seed/bracket/completion/reopen/reset, stale-write, malformed-field, and guest-write denial cases. Broader cross-device and production Group Format rehearsal remains Phase 11 hardening work.

**Phase boundary:** All three competition formats execute in production. App Check enforcement, private-message/prediction/reveal operations, and protected accommodation access remain outside Phase 6.

---

### Phase 7 — Overall championship ledger and leaderboard

**Implementation status:** Complete, deployed, production-connected, and reconciled. All three authoritative competition runtimes feed current deterministic sources; the public leaderboard and organizer bonus/reconciliation tools are live.

**Goal:** Turn the Phase 4–6 per-run point projections into a persisted, weekend-wide, explainable scoring ledger for all three competition formats. Prediction scoring remains deferred.

**Inputs**

- Result sources from Phases 4–6; score model/idempotency keys; design patterns for leaderboard/podium/activity.

**Outputs**

- Exact-format normalization registry that reuses all three engine projections.
- Full-source replacement ledger with deterministic identities/fingerprints and organizer reconciliation.
- Pure leaderboard (no persisted cache), shared ranks, podium, current awards, participant explanations, contributions, and score-neutral achievements.
- Positive, revisioned admin bonuses with active-only public projection, revoke/restore, and audit.
- Presentation-safe score reasons and empty/loading/offline states.

**Dependencies:** Phase 4 result and point-derivation foundation; Phases 5–6 result adapters for complete coverage.

**Acceptance criteria**

1. Every displayed total equals the sum of active ledger entries and no total is client editable.
2. Every point shown has participant, source type/entity, points, reason, timestamp, and deterministic key where required.
3. Replaying any derivation or rebuilding from sources produces no duplicate and the same totals.
4. Result correction replaces the complete source and removes obsolete entries; latest-award presentation does not claim immutable history.
5. Equal totals display tied rankings consistently; podium and full list have accessible alternatives.
6. Queries remain scoped/bounded and update two connected clients in realtime.
7. Reconciliation reports missing, extra, or revision-stale entries before applying an audited repair.

**Main technical risks:** Denormalized cache drift; duplicate triggers; large/broad queries; misleading correction activity; score reason exposing private event data.

**Recommended tests:** Pure derivation golden/property tests; idempotency/retry/failure-injection; full clean rebuild vs incremental equality; cache reconciliation; ties; query/index performance with representative volume; accessible breakdown; multi-device updates.

---

### Phase 8 — Birthday Vault

**Implementation status:** Complete in the repository. Owner-private submission/edit/withdrawal, sanitized receipt counting, revision-aware organizer moderation/order, lifecycle controls, atomic full-set reveal/republish, public gallery, private/public full-screen presentation, default-deny Rules, runtime quarantine, and the expanded emulator/frontend/domain suites are implemented. Deployment of the Phase 8 Rules/frontend remains a deliberate operator action; no remote Firebase resource was changed by this implementation.

**Goal:** Deliver a private guestbook whose submissions remain unreadable to other guests until an organizer publishes an approved snapshot.

**Inputs**

- Phase 2 identity/rules; Phase 7 realtime/presentation foundations; confirmed Phase 8 lifecycle/privacy/content decisions; Birthday Vault locked/reveal design.

**Outputs**

- Validated, owner-scoped guest submission and confirmation flow with revision conflict handling.
- Receipt-derived public message count without public submission reads or identities.
- Organizer moderation, hide, close/reopen, ordering, and approved publication.
- Separate published snapshot path and full-screen replayable presentation.

**Dependencies:** Satisfied. Phase 2 identity and Rules foundations plus Phase 7 presentation/realtime patterns are deployed. Content limits, edit/moderation behavior, anonymous wording, lifecycle, and publication authority are confirmed; general production retention remains Phase 10 policy work.

**Acceptance criteria**

1. Guest can submit permitted fields and sees confirmation/count; a guest cannot enumerate or read another submission by direct SDK/REST access.
2. Organizer can read and moderate private submissions; guests cannot set moderation fields.
3. Hidden/pending entries never appear in the published snapshot.
4. Anonymous-display publication omits/replaces identifying display fields as specified.
5. Publication updates connected clients once, has a stable `publicationId`, and produces an audit entry.
6. Replay runs locally without republishing, changing timestamps, or duplicating data.
7. Rate, field length, unknown-field, and injection tests pass; presentation is keyboard/reduced-motion accessible.

**Main technical risks:** Rules query misconception leaking the collection; unsafe rich text/XSS; count manipulation; anonymous preference not honored; publication race while moderation changes.

**Implemented tests/review:** Pure domain tests cover content normalization/bounds, receipts, moderation freshness, ordering normalization, named/anonymous snapshots, readiness, lifecycle, republish removal, and malformed quarantine. Frontend tests cover live guest states, form/preview, closed editing boundary, anonymous presentation, keyboard close, and organizer workspace access. The 154-case Rules matrix preserves every Phase 2–7 regression and adds 53 focused Birthday Vault authorization, privacy, revision, receipt, moderation, publication, audit, and deferred-path cases. Broader physical-device, multi-client, and production rehearsal remains Phase 11 hardening work.

**Phase boundary:** Phase 8 introduces no prediction data, special-reveal payload, scoring, App Check enforcement, or protected accommodation data. Phase 9 defines its own dual-claim, recently reauthenticated browser boundary.

---

### Phase 9 — Prediction event and protected special reveal

**Implementation status:** Complete in the repository. The neutral two-stage opening/resolution lifecycle, owner-scoped prediction/receipt writes, organizer Special Reveal workspace and private rehearsal, Firebase password reauthentication, dedicated `specialRevealAdmin` claim, five-minute recent-auth Rules policy, browser-side atomic publication/resolution/correction, deterministic prediction ledger, championship integration, default-deny Rules, emergency local Admin SDK fallback, and frontend/domain/Rules suites are implemented. Rules and Pages deployment remain deliberate operator actions; no remote Firebase resource was modified by this implementation.

**Goal:** Support one private neutral prediction per participant, dual-claim recently reauthenticated reveal authorization/publication, and idempotent championship scoring on the zero-cost Firebase/GitHub Pages stack.

**Inputs**

- Phase 2 auth/rules; Phase 7 ledger; Phase 8 locked/reveal presentation pattern; reviewed neutral configuration; a designated Email/Password organizer with both required claims.

**Outputs**

- Dynamic safe labels with stored values only `option-a`/`option-b`.
- Owner-scoped prediction create/update while open and organizer-controlled lock.
- Protected opening, lock, reopen, resolution, correction, and ledger reconciliation with password reauthentication, both custom claims, recent `auth_time`, strict schemas, revision-safe atomic publication/scoring, and neutral audit.
- Trusted local Admin SDK recovery menu that reuses the same platform-neutral derivation and accepts credentials only from outside the repository.
- Realtime neutral locked/published states, optional post-reveal aggregate, full-screen local replay.

**Dependencies:** Satisfied in repository design. Production rollout requires claim provisioning, reviewed neutral content, Rules/frontend deployment in the documented order, and an operator rehearsal. No billing account or server deployment is required.

**Acceptance criteria**

1. A linked participant has at most one prediction and can replace it only while the event is `prediction-open`; private choices cannot be enumerated by another guest or ordinary admin.
2. The lock transition atomically prevents later writes, including stale/offline retries.
3. Missing/single claims, old authentication, wrong-password, invalid-condition, unlocked-event, and stale-revision attempts make no public/ledger mutation. App Check enforcement is explicitly deferred to Phase 10.
4. A successful recent-auth browser operation publishes only reviewed data and atomically awards configured points (default 3) to correct selections.
5. Each correct participant has at most one `prediction:{eventId}:{participantId}` logical score key; repeated same/new request IDs cannot duplicate points.
6. Incorrect selections award 0 and cannot receive a stale/duplicate score.
7. Connected clients update without refresh; replay makes no database write.
8. Repository, source maps, public database paths, logs, analytics, test fixtures, screenshots, names, and docs contain no protected prepublication content, credential, or actual label.

**Main technical risks:** Private content leakage through build/log/error/metadata; compromised reveal-organizer account or unlocked laptop; inspectable client calculation; non-atomic partial publication; stale predictions crossing lock; duplicate scoring.

**Implemented tests/review:** The Rules matrix preserves Phase 2–8 regressions and adds dual-claim/recent-auth privacy, ownership, receipt, lifecycle, public publication, ledger, audit, schema, and default-deny cases. Platform-neutral domain tests cover aggregate filtering, deterministic IDs/fingerprints, full-source replacement, correction, reconciliation, and retry no-ops. Frontend tests cover reauthentication/token refresh/password clearing, missing-role denial, confirmation/cancel/offline behavior, guest lifecycle presentation, owner result visibility, organizer workspace access, neutral fixtures, and championship totals. Phase 9 is deployed and production-tested. Optional App Check, retention, local recovery, and broader hardening are Phase 10; final physical-device rehearsal remains Phase 11.

**Phase boundary:** Phase 9 adds no App Check enforcement, general retention/deletion automation, protected accommodation data, analytics, or automated Rules deployment. The Pages workflow validates and deploys only the frontend `dist/`; Rules and claim provisioning remain manual. Phase 9 is complete, deployed, and production-tested.

---

### Phase 10 — Security hardening

**Status:** Complete in the repository. Remote rollout, App Check registration/monitoring, Rules deployment, and Pages deployment remain deliberate operator actions. No remote resources or production data were changed during implementation.

**Goal:** Turn feature-level controls into a reviewed zero-cost production security posture with staged defense in depth, environment isolation, diagnostics, and recoverable local operations.

**Inputs**

- Feature-complete data paths and Rules; threat model; representative traffic; production Firebase project.

**Outputs**

- Complete least-privilege Rules audit and emulator suite, including recent-auth Birthday publication.
- Optional App Check initialization for both clients, safe diagnostics/degraded mode, and an enforcement-off monitoring runbook.
- Session-scoped organizer persistence, 30-minute idle expiry, five-minute warning, and practical multi-tab coordination.
- Lazy read-only Operations workspace, sanitized preflight/copy, build metadata, `version.json`, and visible-only update polling.
- `noindex`/referrer/robots controls, verified-SHA Actions, grouped Dependabot updates, production dependency audit, and tracked/artifact sensitive-data scanning.
- Hardened local credential/project checks, encrypted backup/inspection, bounded idempotent private cleanup, privacy retention, incident, and pre-event runbooks.

**Dependencies:** Satisfied. Phases 2–9 are complete, deployed, and production-tested; production ownership exists. Phase 10 remains within Authentication, Realtime Database, Rules, and GitHub Pages with no billing expansion.

**Acceptance criteria**

1. Security matrix passes against emulators with root default deny, owner/claim isolation, recent/stale authentication, exact lifecycle/revision/schema constraints, and Phase 2–9 regressions.
2. App Check is disabled by default, can initialize both clients only with complete configuration, rejects production debug, degrades without breaking the static page, reports no token, and is not automatically enforced.
3. Organizer persistence is session-scoped; inactivity warning/expiry, explicit organizer-only sign-out, and recent-auth Birthday/Special Reveal actions are tested.
4. Operations, build metadata/version polling, indexing/referrer controls, dependency/action review, security scan, and CSP deferral rationale are documented/tested.
5. Admin scripts verify credentials, file permissions, credential project, explicit target confirmation, and demo/remote separation.
6. Backup encryption/inspection detects wrong passphrases/corruption without plaintext output; cleanup defaults to dry-run, requires a recent verified backup plus typed phrase, preserves public history, uses one update, and is idempotent.
7. Exact address, Firebase privileged credentials, App Check debug token, PIN/secret values, and protected reveal content remain absent from repository, build, diagnostics, and public examples.

**Main technical risks:** Future App Check enforcement blocking legitimate weekend devices; browser background/timer differences; privileged credential overreach; false confidence in indexing metadata or Firebase client-config secrecy; encrypted-backup custody; operator misuse of destructive cleanup.

**Implemented tests/review:** App Check disabled/enabled/degraded/invalid configurations; organizer idle state; shared recent authentication; Birthday publication ordering; Operations access; version comparison; Rules recent/stale publication and full regression matrix; AES-256-GCM/scrypt round-trip/wrong-pass/corruption; cleanup scope/idempotence; dependency/action/security scans; production artifact inspection. CSP, enforcement, remote restore, and load/alert tuning remain future explicit work.

**Phase boundary:** Phase 10 enables no App Check enforcement, billing/Blaze, Functions, Firestore, Storage, Scheduler, paid API, analytics, protected accommodation storage, remote restore, automated Rules deployment, or production mutation. Phase 11 has begun as a separate UI/UX polish and validation phase.

---

### Phase 11 — Animation polish, accessibility, multi-device QA, rehearsal, and production deployment

**Status:** UI/UX polish slice complete in the repository. Shared control alignment, stable modal focus, organizer-workspace grouping, expanded participant avatars, restrained modal motion, event-gated winner celebrations, automated regressions, and responsive browser review are complete. Physical-device, multi-client, poor-network, full-weekend rehearsal, accessibility-tool audit, and production rollout remain open release-gate work.

**Goal:** Make the complete system delightful and dependable under real weekend conditions, then release through a rehearsed process.

**Inputs**

- Phases 1–10; final approved copy/assets/safe labels; target phones/browsers; travel/competition rehearsal scenarios.

**Outputs**

- Purposeful motion, bracket progression, group draw, count-up, podium/vault presentation, controlled confetti, optional sound off by default.
- Complete reduced-motion and accessible equivalents.
- Performance tuning, error/offline/conflict polish, multi-device test report.
- Organizer operating guide, data backup, rollback plan, final GitHub Pages and production Firebase deployment.

**Dependencies:** All feature/security phases; organizer availability for rehearsal; production secrets/data provisioned out of band.

**Implemented UI/UX review:** The shared button primitive keeps icons, labels, and optional arrows in one horizontal flex row with consistent line height and transitions. Modal focus trapping now initializes only when the dialog opens, so controlled field updates do not steal focus; a regression test covers organizer-style typing. The organizer console separates session controls from a single internally scrollable workspace rail to avoid multi-row crowding on narrow screens. Participant profiles now choose from 16 allowlisted themed icons. Completed Merry-Go-Round and Group Format matches and canonical All Hands session results mark winner avatars with a crown; only a result first observed on an already-known run triggers the brief public celebration and personalized private-participant copy, so initial load and reconnect do not replay historical wins. Motion remains non-blocking and covered by the global reduced-motion rule. Browser review confirms retained input focus and no page-level overflow at 320 px.

**Acceptance criteria**

1. Critical guest and organizer journeys pass on representative iOS Safari, Android Chrome, and desktop presentation browser with multiple simultaneous clients.
2. WCAG AA-oriented audit passes agreed gates: keyboard, focus, headings, labels/errors, screen reader, contrast, reflow, touch targets, accessible bracket/timeline, and live-region restraint.
3. Reduced motion removes nonessential movement; sound remains off by default; animations never block score entry/navigation and replay never mutates data.
4. Offline/reconnect, stale admin revision, function retry, partial failure recovery, and backup/rollback are rehearsed.
5. Initial load and realtime bandwidth meet agreed mobile budgets; listeners are scoped and cleaned up.
6. Complete Friday, Saturday, Sunday departure summary, all three competition formats, birthday publication, prediction lock/reveal, ledger correction, and presentation runbook succeeds with synthetic protected content.
7. Production deploy uses reviewed commit/artifacts, green CI, enforced Rules/App Check plan, backup, and a documented rollback point.
8. A final scan confirms no sensitive content, organizer password, exact address, credentials, or unintended source maps/public data.

**Main technical risks:** Late animation regressions; effects replaying on reconnect; venue connectivity; device sleep/anonymous session loss; production-only configuration drift; an unrehearsed organizer correction during live play.

**Recommended tests:** End-to-end multi-browser/mobile suite; physical-device and poor-network testing; axe plus manual screen-reader/keyboard audit; reduced motion/sound tests; performance budgets; 2–3 organizer concurrency rehearsal; full weekend dry run; deploy/rollback and restore drill; final privacy scan.

## 4. Recommended first vertical slice

After the Firebase foundation and generic creator, prioritize `round-robin-knockout`. It exercises almost every difficult shared concern early: secure/persisted generation, head-to-head series, live result entry, standings, tiebreaks, bracket progression, point derivation, corrections, audit, and multi-device updates. All Hands can then reuse result/point-derivation infrastructure, while Group Format can reuse pairing, standings, and bracket primitives. The cross-competition ledger and its idempotency model remain Phase 7 work.

This order is an architecture decision, not permission to hard-code the engine to any named game.

## 5. Production readiness gate

Production use is blocked until all of the following are true:

- Phase 0 changes and all open security/product decisions marked production-blocking are approved.
- Security Rules, browser-operation idempotency, reauthentication, and privacy tests pass.
- Organizer accounts/claims are provisioned and revocation is rehearsed.
- Protected configuration and any restricted trip data are provisioned only out of band.
- A current database backup exists and restore/rollback instructions are available offline to organizers.
- At least one complete multi-device rehearsal includes result correction, prediction lock, reveal retry, reduced motion, and temporary network loss.
