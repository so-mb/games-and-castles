# Assumptions and decisions

## 1. How to use this register

- **Confirmed requirement:** normative product direction from the approved brief. Implementation may not change it without organizer review and a specification update.
- **Recommended default:** implementation-ready starting value that an organizer may change through supported configuration or review.
- **Open decision:** must be decided before the phase named in the row; the recommendation is not silently treated as approval.
- **Deferred feature:** deliberately outside the first release or postponed to a later phase.

This document records decisions without describing, naming, or inferring protected reveal content. Related technical details live in [product-spec.md](product-spec.md), [game-rules.md](game-rules.md), [data-model.md](data-model.md), and [security-model.md](security-model.md).

## 2. Confirmed requirements and rationale

| ID | Confirmed decision | Rationale / consequence |
|---|---|---|
| CR-01 | GitHub Pages hosts only the static frontend. | Pages has no trusted server runtime. Authentication, shared state, authorization, and protected data access belong in Firebase Auth/Realtime Database/Rules. Client assets and procedures are always inspectable. |
| CR-02 | Firebase Realtime Database is the shared-state store. | The product has modest, tree-shaped live state and needs fast updates across phones for matches, standings, participant lists, counts, and publication. RTDB listeners and atomic multi-location writes fit this event-oriented weekend better than polling. Data must be denormalized carefully and listeners scoped. |
| CR-03 | Guests use Firebase Anonymous Authentication. | It gives each device a UID for ownership/rules without adding account-creation friction during a private weekend. It does not prove identity and needs a participant-link/duplicate policy. |
| CR-04 | Organizers use session-scoped sign-in and Firebase custom claims. | Server-issued claims are enforceable in Rules. Organizer Auth uses browser-session persistence plus 30-minute idle expiry and a five-minute warning. General access requires `auth.token.admin === true`; protected reveal access additionally requires `specialRevealAdmin === true`. Display names, client-side email checks, PIN UI, or database booleans do not authorize. |
| CR-05 | The application is mobile-first. | Participants primarily use phones during travel and live play. It affects content order, touch targets, score entry, bracket views, connectivity feedback, and performance budgets. Desktop remains important for organizer/presentation use. |
| CR-06 | Competition formats are generic. | User-entered game names remain data, allowing different games without engine forks or trademark-specific rules. Only the three exact format identifiers select behavior. |
| CR-07 | Overall totals are ledger-derived. | Individual entries make scoring explainable, idempotent, correctable, auditable, and rebuildable. A manually incremented total drifts under retries/corrections and cannot explain points. |
| CR-08 | Individual round wins contribute to the overall championship. | Close losses still contribute and individual series rounds matter. These awards are separate from standings table points and configurable per competition. |
| CR-09 | Confirmed fixture and group orders are persisted once. | All devices must share one official draw/order. Regenerating on render/reconnect creates disagreement and can erase the meaning of existing results. Reset is explicit, destructive, and audited. |
| CR-10 | Result correction triggers full affected recalculation. | Standings, qualification, bracket dependencies, score entries, leaderboard, and read caches must reflect the authoritative corrected result. Adding manual compensation alone would leave invalid derived state. |
| CR-11 | Sensitive reveal content is restricted Firebase data before publication. | Anything in React, Vite variables, public database paths, CSS, source maps, logs, examples, names, or repository history can be inspected. Dual-claim Rules protect private configuration; only the recently reauthenticated reveal organizer may publish. |
| CR-12 | Prediction scoring is reveal-organizer-controlled and idempotent. | The privileged browser selects the outcome only during resolution and replaces a complete deterministic source. The key `prediction:{eventId}:{participantId}` ensures retries never award twice. |
| CR-13 | Public accommodation information is limited to `Žižkov, Prague 3`; the exact address is excluded from the static application and repository. | A hidden frontend button is not security. The exact address must not appear in client data, mock data, public examples, or commits. A later authenticated implementation may retrieve it from restricted Firebase data after separate authorization review. |
| CR-14 | Private birthday submissions are not downloaded to other guests. | Security is path- and Rules-based, not client filtering. Publication creates a separate approved snapshot; the public count derives only from identity-free receipts. |
| CR-15 | The first implementation vertical slice prioritizes `round-robin-knockout`. | It exercises the shared hard parts early: generation, persistence, series, standings, tiebreaks, brackets, round scoring, corrections, audit, and live synchronization. Later formats reuse those primitives. |
| CR-16 | Animation is controlled and secondary to usability. | Important moments benefit from motion, but score entry/itinerary access must stay fast. Reduced motion is respected; sound is off by default; no constant distracting animation. |
| CR-17 | Development and production use separate Firebase projects. | This prevents test identities, claims, synthetic reveals, permissive experimentation, and data migrations from affecting the live weekend. |
| CR-18 | Saturday, 1 August 2026 follows the approved itinerary and priorities, beginning with departure from Germany at 06:55. | The document must preserve the planned timeline and approximately 12:30 Prague arrival, mark all tourist attractions free, shorten/skip the museum first if delayed, skip Kampa before reducing Charles Bridge, and protect fixed dinner/cinema bookings. |
| CR-19 | The displayed trip range is 31 July–2 August 2026. | Friday, 31 July is flexible Game Night in Germany with no fixed times; Saturday, 1 August is the scheduled Prague Quest; Sunday, 2 August has three confirmed departure groups—first by 08:50, second by 09:00, and third by 09:20—all leaving Prague from Central Bus Station Florenc. No other Sunday itinerary details are inferred. |
| CR-20 | Phase 2 organizer sign-in uses Firebase Email/Password Authentication with no public sign-up or password-reset flow. | Authorization still comes only from `auth.token.admin === true`; an authenticated email alone grants nothing. Initial users and claims are provisioned out of band. |
| CR-21 | Phase 2 guest identity is browser-local and has no recovery or cross-device claim flow. | Anonymous Auth persistence keeps continuity in the same browser. Clearing storage or changing browser/device may create a new UID; display names are never accepted as ownership proof. |
| CR-22 | Safe static itinerary content renders independently of Firebase authentication and configuration. | Live participant reads require Authentication, while missing/broken configuration is isolated to the live feature area. |
| CR-23 | Production Pages builds receive the six public Firebase web-configuration values through GitHub Actions repository variables, with emulator mode disabled. | Public Firebase client configuration is expected to be browser-visible and is not a secret. Repository variables keep environment configuration out of source control; service credentials remain prohibited. The Phase 2 production deployment is configured and successfully connected to Firebase. |
| CR-24 | Phase 3 competition configuration uses conservative hard bounds. | Title/game fields are at most 60 characters, descriptions 280, metric labels 40, participant IDs 128, participant selections and placement rows 32, First to N 10, planned sessions 50, groups 8, and integer point fields 0–100. Required publish fields use a two-character minimum. Client validation, runtime parsing, and Rules enforce the bounds each layer can express. |
| CR-25 | Phase 3 uses only `draft`, `scheduled`, and `archived` competition states. | `scheduled` means a guest-readable configuration with fixtures pending, not an active competition. The execution lifecycle remains reserved for Phase 4 onward. Archive/restore is reversible; unused drafts may be deleted after confirmation. |
| CR-26 | Phase 4 Merry-Go-Round uses `scheduled → active → completed`, with strong confirmed reopen and pre-result-only reset. | Activation freezes and persists one runtime; completion persists placements; reopen preserves results and returns to knockout. Active/completed runs are never archived or hard-deleted. |
| CR-27 | Head-to-head breaks a tie only when exactly two participants remain tied. | Multi-participant/circular cohorts continue through round differential, rounds won, and match wins, then require an explicit audited organizer order. Names, IDs, fixture order, and randomness never break sporting ties. |
| CR-28 | Any configured even qualifier count uses the next-power-of-two standard seeded bracket, with byes assigned to the highest seeds. | This supports 2/4/6/8 and other valid even fields deterministically; seed 1 and seed 2 cannot meet before the final. |
| CR-29 | Phase 4 blocks activation when draws are enabled. | Phase 3 stores the toggle, but no terminal series-draw rule is approved. Decisive single/best-of/first-to results are supported; draw execution remains open rather than inferred. |
| CR-30 | Phase 4 derives itemized projected points per Merry-Go-Round run but persists no score ledger. | Match wins, individual rounds, participation, qualification, and final placement awards recalculate from authoritative results. Phase 7 owns cross-competition persistence and the global leaderboard. |
| CR-31 | A configured third-place match must be completed before competition completion. | This makes third and fourth place deterministic in the placement snapshot; without it, only champion and runner-up receive exact final places. |
| CR-32 | Phase 5 All Hands uses the same `scheduled → active → completed` lifecycle, with strong confirmed reopen and pre-result-only reset. | Activation freezes eligibility and configuration; sessions/results are preserved through completion and reopen; a run with any result cannot be casually deleted. |
| CR-33 | All Hands session awards use the frozen competition placement table, winner bonus, and participation points; custom mode stores bounded direct points. | One explainable award model ranks the competition and previews its future Phase 7 contribution without persisting a global ledger. |
| CR-34 | All Hands team awards use `each-member` distribution only. | Every team member receives the full derived team award. Persistent teams and split/rounding policies remain outside Phase 5. |
| CR-35 | Shared All Hands placement uses competition ranking (`1, 1, 3`); manual ordering requires unique positions. | Shared entities receive the configured points for the shared declared place. No name, ID, creation order, or randomness resolves a sporting tie. |
| CR-36 | Numeric All Hands results use generic primary and optional secondary metric labels/directions. | Raw scores remain session-local and are never summed as a universal competition tiebreak. Equal configured metrics remain shared or require the frozen manual order policy. |
| CR-37 | All Hands custom results accept one non-negative integer point value from 0–100 and an optional plain-text note up to 160 characters per entity. | This resolves OD-10 with a Rules-verifiable shape and excludes executable formulas, arbitrary objects, and rich text. |
| CR-38 | Group Format automatic counts are 1/2/3/4 groups for 4–5/6–8/9–12/13–16 participants; outside that range activation requires a validated manual count. | This resolves OD-11 without inventing an extrapolated automatic policy. The secure shuffle is followed by deterministic round-robin assignment, producing group sizes that differ by at most one. |
| CR-39 | Group qualification is an explicit frozen snapshot created only after every real group match and every qualification-affecting group tie is resolved. | Group ID/rank, normalized metrics, standings fingerprints, and the source runtime revision remain explainable and cannot drift under later presentation derivation. |
| CR-40 | Cross-group knockout seeds preserve group-rank tiers, use normalized per-match metrics within a tier, require organizer order for remaining equality, and permute only equivalent lower-tier opponents to avoid first-round rematches. | Higher-rank tiers and deserved BYEs remain intact. The two-group/two-qualifier golden pairing is A1–B2 and B1–A2; an unavoidable rematch is disclosed before bracket confirmation. |
| CR-41 | A Group Format run may return to scheduled only before any result exists. A qualifier-changing group correction after knockout generation requires an explicit complete knockout reset; a knockout correction clears only affected descendants when possible. | Draw identity and played history are never casually reshuffled or silently left inconsistent with qualification. |
| CR-42 | Phase 7 stores one complete deterministic ledger source per active/completed competition and replaces it on every score-relevant runtime change. | Corrections, reopen, void/restore, knockout reset, retry, and backfill cannot append duplicate or obsolete awards. |
| CR-43 | Manual bonuses are positive 1–100 point revisioned records; revoked records remain organizer-visible and are removed from the sanitized public projection. | No hard deletion or negative point editing; every create/revoke/restore appends safe audit metadata. |
| CR-44 | Public totals, shared ranks, contributions, latest awards, and achievements are pure ledger derivations. | No mutable participant total or leaderboard cache is persisted; active zero-point and inactive historical participants remain explainable. |
| CR-45 | Public correction visibility shows only current valid awards plus a verification warning for missing/stale/malformed sources. | This resolves OD-12 without exposing confusing before-values or pretending the current-award view is immutable history. |
| CR-46 | Birthday Vault uses one UID-keyed message, an immutable opaque publication UUID, named/anonymous display, current-revision moderation, and sanitized full-set publication. | Guests can edit or withdraw only while collecting; edits stale prior approval; hidden/withdrawn entries do not publish; anonymous snapshots contain no participant or owner identity. This resolves former OD-13; CR-58 defines post-event retention. |
| CR-47 | Birthday Vault lifecycle is unopened, `collecting`, `closed`, then irreversibly `revealed`; a revealed vault may only republish a new complete snapshot revision. | Organizer authentication plus revision-checked Rules authorize transitions. Replay is local-only, and the exact non-secret confirmation phrase `REVEAL` prevents accidental publication. |
| CR-48 | The UI has no casual individual-prediction view; before resolution, ordinary clients expose only the owner's selection and identity-free active receipts. | This resolves OD-14 with the least-privilege product behavior. A recently reauthenticated reveal organizer can read the collection to resolve it; the option distribution becomes public only with resolution. |
| CR-49 | Reviewed dynamic prompt and option labels remain organizer-only until the protected opening operation publishes them. | This resolves OD-15. Persisted selections use only configured neutral identifiers from `option-a` through `option-h`; no label or unselected resolution payload is returned before its lifecycle boundary. |
| CR-50 | Protected Special Reveal actions require both `admin` and `specialRevealAdmin`, Firebase password reauthentication, and a token with `auth_time` no more than five minutes old. | There is no app-specific reveal credential or custom browser limiter. The password is cleared before persistence; Rules independently enforce claims, recent authentication, transitions, revisions, shapes, and bounds. |
| CR-51 | The Phase 9 lifecycle is unopened, `prediction-open`, `prediction-locked`, then `resolved`; lock may reopen before resolution, while correction keeps predictions locked. | Recent-auth browser mutations and Rules enforce one-step revisions. Resolution/correction atomically replace the selected public payload and complete deterministic prediction-ledger source. |
| CR-52 | Phase 9 App Check remains deferred until Phase 10 monitoring and rollout. | Authentication, both claims, password reauthentication, recent-auth Rules, revision/state checks, strict schemas, and atomic updates are enforced now; App Check remains defense in depth rather than a Phase 9 completion claim. |
| CR-53 | Phase 10 App Check is optional, staged, and disabled by default; it is not automatically enforced. | Both Firebase app instances initialize Enterprise attestation only with an explicit complete config. Misconfiguration/token failure degrades safely. Production debug is invalid. Enforcement requires a separate zero-cost, device-tested operator decision. |
| CR-54 | Birthday Vault reveal and republish require recent Firebase password reauthentication. | A typed consequence phrase prevents mistakes but is not authentication. The shared five-minute `auth_time` Rules window and one-minute action authorization now protect both Birthday publication and Special Reveal sensitive operations. |
| CR-55 | Organizer sessions end with the browser session and after 30 minutes of inactivity, with a warning during the final five minutes. | This reduces unattended-device exposure without replacing claims, Rules, or explicit sign-out. Anonymous guest identity remains separately browser-local. |
| CR-56 | Phase 10 diagnostics are sanitized, read-only, and include deployed-build awareness. | Operations exposes safe status/count/build metadata only; `version.json` contains commit/ref/time only. No token, UID, email, private payload, exact address, or enforcement claim is copied. |
| CR-57 | Private post-event data cleanup requires a recent authenticated encrypted backup and preserves public results/history. | Local tools validate credential/project, use scrypt plus AES-256-GCM, write no plaintext, default cleanup to dry-run, require `PURGE PRIVATE DATA`, apply one bounded update, append safe audit metadata, and converge to a no-op on retry. |
| CR-58 | Private event-source cleanup runs within seven days after the trip; encrypted backups are retained 30 days after cleanup by default, and safe audit metadata is reviewed after 90 days. | This resolves former OD-19 while preserving published history and a short correction/recovery window. Exceptions require an organizer-recorded hold; Auth-user/participant deletion remains a separate referential review. |
| CR-59 | Phase 11 UI polish is implemented through shared primitives and compact organizer grouping. | Button icon/label layout and modal focus stability are fixed centrally. Organizer workspaces use one internally scrollable tab rail rather than a crowded multi-row control block; remaining physical-device rehearsal is still required. |
| CR-60 | Phase 11 win celebrations are derived locally from newly observed authoritative completion events, and participant avatars use a 16-icon Rules allowlist. | Initial run state is baselined so refresh/reconnect does not replay historical wins. Match/session cards keep a crown winner marker, the private view personalizes only by authenticated participant ID, reduced motion omits confetti, and the brief animation settles into a result panel that remains until dismissed. No celebration state or new personal data is persisted. |
| CR-61 | A Special Reveal supports 2–8 configured choices using stable neutral identifiers `option-a` through `option-h`. | `option-a` and `option-b` are the permanent minimum; each configured choice requires one label and one private resolution payload. Additional choices may be added or removed only before opening, existing two-option records remain valid, and the option set freezes with the rest of the configuration once public state exists. |
| CR-62 | Active and completed public competition dashboards are organized as a single-open accordion, collapsed by default. | Each summary preserves format, game title/name, live/completed status, participant count, avatars, keyboard focus, and an explicit expand/collapse name. Opening a game closes the previous dashboard, while scheduled cards remain compact and reduced motion removes the height transition. |
| CR-63 | The mobile sticky navigation is icon-only, while desktop navigation retains text labels. | The G&C mark, six section icons, and Organizer/Studio icon remain visible in one compact row. Every icon control keeps its full accessible name, keyboard focus treatment, and active-section indicator, so removing visible mobile labels does not remove orientation for assistive technology. |

## 3. Required terminology

| Domain identifier | Friendly UI label | Notes |
|---|---|---|
| `round-robin-knockout` | Merry-Go-Round | Complete single round robin, then configurable knockout |
| `all-hands` | All Hands | One or more simultaneous individual/team sessions |
| `group-knockout` | Group Format | Balanced randomized groups, internal round robin(s), then knockout |
| `specialReveal` | Context-dependent neutral label | Neutral in paths/code/docs; never encode protected subject |
| `predictionEvent` | Prediction event | Selections use configured neutral IDs from `option-a` through `option-h` |
| `revealSequenceB` | Optional neutral implementation label | Use only if a second neutral sequence identifier is necessary |

Do not create aliases for the format identifiers in persisted data. Friendly labels belong only at the presentation boundary.

## 4. Recommended defaults

| ID | Default | May be changed by | Reason |
|---|---|---|---|
| RD-01 | Round-robin table points: win 3, loss 0, supported draw 1 | Organizer before competition start | Familiar qualification model, separate from weekend points |
| RD-02 | Championship: match win 2, individual round win 1 | Organizer before start | Rewards both overall result and round performance |
| RD-03 | Completed-match participation bonus 0/off | Organizer before start | Avoids inflating totals unless participation is intentionally rewarded |
| RD-04 | Correct prediction 3 championship points | Reveal organizer before event opens | Meaningful but bounded contribution; atomically awarded from frozen configuration |
| RD-05 | Six-player Merry-Go-Round qualifies top four: 1v4, 2v3, final, optional third place | Organizer in competition config | Clear seeded structure after complete league play |
| RD-06 | Six-player Group Format uses two groups of three, top two, A1vB2/B1vA2 | Organizer in competition config | Balanced groups and cross-group semifinals |
| RD-07 | Automatic groups: 4–5 one; 6–8 two; 9–12 three; 13–16 four | Organizer may choose validated manual count | Keeps groups practical and within one participant in size |
| RD-08 | All Hands tied placements share the declared place's configured points | Organizer before session/competition starts | Easiest to explain; avoids implicit fractional rounding |
| RD-09 | Team award policy is `each-member` | Organizer before session | Clear and celebratory; displayed award explains per-member points |
| RD-10 | Overall equal totals share rank (`1, 1, 3`) | Fixed unless product spec changes | No hidden weekend tiebreak was approved |
| RD-11 | Locked prediction aggregate remains hidden until reveal | Organizer/event policy | Preserves surprise and avoids social influence |
| RD-13 | Birthday publication is a snapshot; replay is client-only | Fixed implementation behavior | Moderation remains stable and animation cannot duplicate writes |
| RD-14 | Cryptographic Fisher–Yates shuffle plus circle method | Fixed technical behavior | Unbiased initial order and proven complete pairings |
| RD-15 | Replace the complete current competition source; retain safe correction metadata in append-only audit | Fixed Phase 7 behavior | Current totals never include obsolete awards, while organizers retain who/when/action context without duplicating sensitive before-values |
| RD-16 | User sound is off by default | User can opt in | Avoids surprise/disruption and meets the brief |
| RD-17 | Show an identity-free active prediction count before resolution; publish the option distribution only with the final resolution | Fixed Phase 9 behavior | Provides useful participation feedback without exposing owners or influencing predictions with a live split |

Defaults are copied into the relevant event/competition record and frozen when play/event state begins. Changing a default later does not rewrite historical competitions.

## 5. Open organizer and implementation decisions

These items require confirmation; recommendations indicate the least-risk starting point.

| ID | Decision required | Recommendation | Needed before |
|---|---|---|---|
| OD-05 | Set remaining maximum active-participant/competition record counts, message lengths/counts, and later custom-field counts. Phase 3 per-record configuration bounds are confirmed in CR-24. | Use conservative UI/rules/function limits based on the private group size and load-test at twice expected volume. | Feature-owning later phase |
| OD-06 | Define a terminal series-result rule before enabling match draws. Phase 4 deliberately blocks draw-enabled activation under CR-29. | Keep draws off until a bounded maximum-round/terminal rule is approved; never infer one from table draw points. | Later draw-support change |
| OD-20 | Confirm performance budgets and whether remote webfonts/photography are acceptable. | Self-host/subset at most two fonts where licensing allows; mobile-first optimized imagery; define budgets during Phase 1. | Phase 1/11 |
| OD-21 | Recheck the planned Prague transport route and opening/access conditions close to travel. | Preserve the approved itinerary in the app, but perform a current authoritative check before deployment/travel and update only with organizer approval. | Phase 11 rehearsal |
| OD-22 | Confirm cinema booking display details and whether any booking reference may be shown. | Show only the approved venue/time/screening description; keep booking references out of public data. | Phase 1/11 copy freeze |

Phases 1–9 are deployed, production-connected, and production-tested. Phase 10 and the Phase 11 UI/UX polish slice are complete in the repository; remote rollout and the broader Phase 11 rehearsal gate remain explicit operator actions. CR-45 resolves former OD-12, CR-46/CR-47 resolve former OD-13, CR-48–CR-52 resolve former OD-14–OD-16, and CR-53–CR-58 resolve the Phase 10 staging/session/retention decisions formerly represented by OD-18/OD-19. App Check enforcement is intentionally not a Phase 10 completion requirement and remains a future explicit go/no-go decision. OD-06 blocks only future draw support.

## 6. Technical architecture decisions

### AD-01 — Static frontend, Firebase-managed services

**Decision:** Deploy React assets to GitHub Pages; use Firebase services for all shared/authorized behavior.

**Alternatives considered:** Storing state in the repository, local-only state, or trying to hide values in the static build. These cannot provide secure realtime multi-user mutations. A custom server could work but adds operations beyond the selected stack.

**Consequences:** Correct Vite base paths and static fallback strategy are required. Firebase availability/network state must be visible. All client requests are hostile by default.

### AD-02 — Realtime Database over a document store

**Decision:** Use Firebase Realtime Database.

**Reason:** The domain consists of small live trees, shared match/session state, leaderboards, and lock/reveal transitions. RTDB offers simple listeners, transactions, and multi-location fan-out.

**Consequences:** Design shallow access-oriented paths; do not fetch roots; explicitly maintain indexes/read models; Security Rules cannot filter unauthorized children from a readable parent.

### AD-03 — Stable IDs and discriminated format unions

**Decision:** Reference participant and source IDs, and model formats using `kind` discriminants.

**Reason:** Names change and collide; discriminated unions prevent invalid format/config combinations and keep engines generic.

**Consequences:** UI resolves display information separately; historical display snapshots are optional denormalization, not foreign keys.

### AD-04 — Source results plus deterministic derivation

**Decision:** Results/event outcomes are authoritative sources. Standings and leaderboard views are rebuildable; ledger entries have stable source keys.

**Reason:** Retrying/correcting must converge on the same outcome.

**Consequences:** Derivation functions should be pure and heavily tested. Persisted caches carry source revisions and reconciliation tools.

### AD-05 — Trusted publication snapshots

**Decision:** Protected prepublication content remains on restricted paths and is copied into a separate sanitized public snapshot only at publication. Phase 8 uses an admin-claim organizer; Phase 9 uses the recently reauthenticated dual-claim reveal organizer documented in AD-15.

**Reason:** Toggling a boolean beside already-public data does not prevent prior reads/downloads.

**Consequences:** Special Reveal publication is one idempotent, Rules-validated root update. Birthday Vault presentation replay likewise reads a published snapshot without mutation, but its authority is defined separately in AD-14.

### AD-06 — Revision-based multi-admin control

**Decision:** Privileged mutations include expected revisions and idempotent request IDs.

**Reason:** Last-write-wins can erase another organizer's result or lock state.

**Consequences:** Conflicts require explicit UI. Configuration, competition runtime, ledger, Birthday Vault, and Special Reveal writes use Rules-enforced revision increments, atomic multi-path updates, and audit records. Stale runtime, match, session, result, or reveal revisions are denied and reloaded; complete-source replacement makes retries idempotent.

### AD-07 — Phase 1 is a typed, anchor-based static shell

**Decision:** Use a single React/Vite page with native anchors, Intersection Observer active-section tracking, Tailwind-backed CSS tokens, typed static content modules, Lucide icons, CSS decoration, and preview-labelled mock championship data. Configure Vite with the fixed `/games-and-castles/` GitHub Pages base path.

**Reason:** The product has one documented page flow and does not need a routing dependency or server rewrite. Typed data can later be replaced by Firebase-backed adapters without embedding trip content in large JSX components. CSS and icon-based artwork keeps the Phase 1 bundle lightweight and avoids remote image, font, licensing, and privacy risks.

**Consequences:** Phase 1 contains no persistence or trusted behavior. Birthday, prediction, result, leaderboard, and reveal controls remain disabled or explicitly presentation-only. A future change to the repository name or hosting path requires updating the Vite base configuration and deployment test.

### AD-08 — Isolated guest and organizer Firebase clients

**Decision:** Use the default Firebase app for browser-local anonymous guest Auth/RTDB and a named Firebase app for session-scoped organizer Email/Password Auth/RTDB.

**Reason:** Firebase Auth supports one current user per Auth instance. A shared instance would replace and potentially lose the browser's anonymous guest session when an organizer signs in on the same device.

**Consequences:** Both clients use the same public project configuration and Rules, but their Auth persistence and database requests carry independent ID tokens. Organizer sign-out returns the organizer surface to signed-out state without changing the guest UID.

### AD-09 — Phase 3 flat configuration paths and direct claim-authorized writes

**Decision:** Implement the current competition slice at `/competitionDrafts/{competitionId}`, `/competitions/{competitionId}`, and `/audit/{auditId}`. Drafts and audit history are organizer-readable; authenticated guests may read published competition records. Only `auth.token.admin === true` may mutate these branches. Phase 3 configuration operations use atomic Realtime Database multi-location writes and revision preconditions directly from the organizer client.

**Reason:** These paths extend the flat Phase 2 participant/profile schema without prematurely creating a later `/public` and `/organizer` hierarchy. Competition configuration is public-safe after publication and has no trusted scoring, generated state, private submission, or protected reveal payload; the Rules provide the required authority for this bounded slice.

**Consequences:** Publishing atomically creates the scheduled record, removes its draft, and appends safe audit metadata. Reordering is part of versioned competition state, so each affected record advances its revision. Configuration readers reject malformed/unsupported records, guest UI filters archived records, and privileged writes are disabled offline. AD-10 supersedes only the former Phase 4 runtime reservation; ledger and protected publication paths remain denied.

### AD-10 — Phase 4 deterministic client engine with Rules compare-and-set

**Decision:** Store the complete Merry-Go-Round runtime at `/competitionRuns/{competitionId}`. Pure TypeScript functions derive the next runtime from authoritative source results; the organizer client submits one atomic update across runtime, competition status when needed, and append-only audit entries. Realtime Database Rules authorize only `auth.token.admin === true` and enforce legal state, schema, immutable snapshot/fixture fields, participant/result shapes, and one-step revisions. Authenticated guests receive read-only runtime subscriptions through the isolated guest Firebase client.

**Reason:** The Phase 4 data is public-safe to authenticated trip participants, deterministic, bounded to one competition, and fully verifiable through version/state/shape Rules. Keeping generation, standings, bracket progression, correction, and points derivation pure makes retries, tests, future migration, and Phase 7 reuse explainable.

**Consequences:** Phase 4 production mutation depended on separately deploying its version-controlled Rules; that deployment is now complete. Two organizer devices cannot silently overwrite one another; the loser receives an actionable stale-state conflict. Runtime adapters quarantine malformed data and normalize RTDB-omitted nulls. Audit is compact and organizer-authored. AD-11 and AD-12 subsequently authorize the All Hands and Group Format runtime branches; persisted standings, the global ledger, App Check changes, private submissions, predictions, reveals, and protected trip-data access remained unauthorized at that phase gate.

### AD-11 — Phase 5 format-discriminated All Hands runtime

**Decision:** Extend `/competitionRuns/{competitionId}` with an exact `format: 'all-hands'` branch. Activation freezes eligible participant IDs and the normalized Phase 3 configuration. Pure TypeScript functions create and validate session-local individual/team entities, derive awards/standings/final placements, and produce revisioned next states. The organizer client submits runtime, competition status when needed, and compact audit entries atomically; authenticated guests subscribe through the isolated guest client.

**Reason:** All Hands execution data is public-safe to authenticated trip participants, bounded to one competition, and deterministic from frozen configuration plus raw session results. A discriminated runtime preserves the deployed Merry-Go-Round path and avoids a duplicate public copy or prematurely introducing the Phase 7 ledger.

**Consequences:** Team awards are `each-member`; shared places use competition ranking; numeric labels/directions are generic; custom points are bounded and contain no executable formula. Corrections replace source results and rederive all totals, while void/restore and new results invalidate stale final tie decisions. Completed runs reject ordinary session mutations until an explicit atomic reopen. The Phase 5 Rules are deployed and production-tested. AD-12 subsequently authorizes Group Format; global ledger persistence, App Check changes, private submissions, predictions, reveals, and protected trip data remained unauthorized at that phase gate.

### AD-12 — Phase 6 frozen Group Format draw and qualification runtime

**Decision:** Extend `/competitionRuns/{competitionId}` with an exact `format: 'group-knockout'` branch. A cryptographic local shuffle produces a reviewable balanced draw; only explicit confirmation atomically persists that exact participant order, groups, interleaved fixtures, active competition status, and audit events. Pure TypeScript functions derive group standings, fingerprinted tie decisions, the frozen qualification snapshot, normalized seed tiers, deterministic lower-tier rematch avoidance, the shared knockout graph, placements, and itemized projected points. The organizer client submits one-step revisioned mutations; authenticated guests subscribe read-only through the isolated guest client.

**Reason:** Group execution is public-safe to authenticated trip participants but needs a stronger freeze boundary than configuration. Persisting source results and explicit sporting decisions—rather than standings or mutable totals—keeps corrections, retries, Rules validation, and future Phase 7 ledger derivation explainable. The local preview avoids publishing a draw that the organizer has not confirmed, while the exact persisted snapshot prevents reconnects or other devices from reshuffling it.

**Consequences:** Automatic group count is deliberately bounded to 4–16 participants; valid manual counts cover other supported participant totals. Draw-enabled activation remains blocked. Qualification cannot be created from an incomplete persisted group stage, equal cross-group metrics require an audited order, highest seeds retain BYEs, and first-round opponents move only within an equivalent lower rank tier. A started run cannot be redrawn; a qualifier-changing correction explicitly removes the complete knockout before returning to group play. The Phase 6 Rules are deployed and production-tested. Phase 7 now normalizes this runtime's projected awards; private/protected later features remain unauthorized.

### AD-13 — Phase 7 deterministic championship sources and split bonus visibility

**Decision:** Persist `/championshipLedger/competitionSources/{competitionId}` as a complete normalized snapshot derived from the authoritative runtime. Use deterministic entry IDs and a canonical source fingerprint, and replace/remove the full source atomically with application runtime mutations. Store manual bonus history under organizer-only `/manualBonuses` and publish active sanitized records under `/manualBonusesPublic`.

**Reason:** Realtime Database cannot securely filter revoked children from a guest-readable collection. Full-source replacement makes retries, corrections, reopen, void/restore, knockout reset, and legacy backfill deterministic without mutable totals or compensating entries.

**Consequences:** Admin-claim Rules authorize only bounded source and bonus writes; guests remain read-only. Championship Desk reconciles legacy runs and removes confirmed orphans. Public clients quarantine malformed data and show a verification warning for uncertain expected sources. Competition-derived entries have no direct edit API. Phase 7 is deployed and the production sources are reconciled.

### AD-14 — Phase 8 Rules-validated Birthday Vault publication

**Decision:** Store Birthday Vault state, sanitized receipts, owner-private messages, organizer-only moderation, and sanitized published snapshots below `/birthdayVault`. Guest submission/withdrawal atomically writes the owner's message and matching opaque receipt. An admin-claim organizer client re-reads and validates the current private/moderation set, then atomically replaces the complete published set with public state and append-only audit metadata.

**Reason:** Birthday publication has no server-only outcome, protected code, or hidden payload: the organizer is already authorized to read the source messages and decide moderation. Default-deny Rules can enforce owner/profile linkage, immutable publication identity, lifecycle/revision boundaries, receipt coupling, published shape, admin authorization, and the atomic state/snapshot boundary. Runtime readiness additionally blocks pending, stale, malformed, duplicate, offline, or missing-profile publication cases that Realtime Database Rules cannot safely quantify across arbitrary sibling collections.

**Consequences:** One owner UID has one retained record and one stable UUID across edit/withdraw/resubmit. Other guests can read only public state, identity-free receipts, and revealed snapshots. Anonymous snapshots omit owner and participant identity. Approval becomes stale after a message revision. Reveal requires current-password reauthentication plus exact `REVEAL` confirmation and is irreversible; republish uses the same recent-auth boundary, replaces the full set, and advances `revealRevision`. AD-15 defines the separate Phase 9 reveal boundary.

### AD-15 — Phase 9 browser-first protected reveal

**Decision:** Use Firebase Email/Password reauthentication plus `admin === true`, `specialRevealAdmin === true`, and a five-minute `auth_time` Rules window for protected reveal operations. The privileged organizer browser reads restricted configuration/predictions, reuses platform-neutral deterministic derivation, and submits one root atomic update. A local Admin SDK menu using credentials outside the repository is the emergency fallback.

**Reason:** This preserves the protected lifecycle, private predictions, deterministic points, correction, reconciliation, and realtime presentation using the free Authentication and Realtime Database products. A second app-specific browser credential would be inspectable and provide false security.

**Consequences:** The browser procedure is inspectable and the dual-claim organizer device is trusted to compute aggregates. Rules cannot recompute an arbitrary collection aggregate, but they independently enforce both claims, recent authentication, legal transitions, revisions, event relationships, strict shapes, configured point bounds, deterministic source structure where maintainable, and append-only audit. The password is never persisted or passed to database repositories. Ordinary admins cannot access private reveal data or controls. There is no custom password-attempt store; Phase 10 adds optional staged App Check without changing this authorization boundary.

### AD-16 — Phase 10 zero-cost production hardening

**Decision:** Keep Firebase Authentication and Realtime Database as the only production Firebase products. Add staged App Check configuration, session-scoped organizer persistence/idle expiry, shared recent-auth policy, read-only Operations diagnostics, build metadata/version polling, indexing/referrer controls, pinned Actions/Dependabot/security scanning, credential-safe encrypted backups, and bounded post-event cleanup. Do not enable enforcement or create/change any remote resource automatically.

**Reason:** These controls materially reduce unattended-device, stale-build, credential, supply-chain, accidental-publication, and post-event-retention risk while respecting GitHub Pages' inspectable browser boundary and the strict no-payment/no-Blaze requirement.

**Consequences:** Enterprise attestation is used only if the Firebase Console offers it within the zero-cost boundary; otherwise it stays disabled. `robots.txt`/`noindex` reduce discovery but are not privacy controls. CSP is deferred until Firebase/reCAPTCHA origins can be tested without blocking legitimate devices. Automated restore is deliberately absent because overwriting live data needs separate authorization and rehearsal. Phase 11 UI/UX polish is now implemented separately; its physical-device and production rehearsal work remains open.

## 7. Assumptions currently used by the specification

These are bounded assumptions, not newly confirmed requirements:

1. The group size is small enough that RTDB per-competition paths and a full leaderboard are practical, while implementations still avoid root listeners.
2. Every scoring participant can be represented by one stable participant ID, even if the anonymous browser session changes.
3. Organizers will be online for consequential operations; offline privileged writes are not queued.
4. Published competition scores and safe participant display names are acceptable to every authenticated group member.
5. Tourist attraction “free” badges refer to admission to the planned areas, not transport, food, optional purchases, cinema, or guarantees about future access.
6. The approved itinerary is a plan, not live navigation; transport/access details may change and need a current check.
7. All Hands custom scoring can be expressed by declared typed fields and award mappings without executing user-provided code/formulas.
8. Presentation mode runs from an organizer device but shows only audience-safe public data.
9. A stable internet connection cannot be guaranteed, so read state remains visible with freshness labels and critical writes require acknowledgement.

If any assumption proves false, update the affected specification and phase acceptance criteria before changing architecture.

## 8. Deferred features

| ID | Deferred item | Reason / reconsideration point |
|---|---|---|
| DF-01 | Native iOS/Android applications | Web/mobile-first experience is sufficient for the private event; reconsider only after first release. |
| DF-02 | Full installable PWA and guaranteed first-load offline | Adds cache/privacy/update complexity; static itinerary after initial load plus clear offline state is the initial target. |
| DF-03 | Push notifications/background sync | Not required for one-page shared live use; may complicate consent and stale actions. |
| DF-04 | Public accounts, discovery, sharing, ticketing, payments | Product is a private group weekend. |
| DF-05 | Chat, live location, and public photo uploads | Privacy/moderation scope and bandwidth are disproportionate to core goals. |
| DF-06 | Automatic live transit rerouting | The itinerary is approved editorial content; current routing needs a separate trusted data source and failure policy. |
| DF-07 | Hard-coded integrations/rules for named games | Conflicts with the generic engine principle. |
| DF-08 | Automated organizer-final tiebreak adjudication | Human decision remains explicit/audited after published deterministic tiebreaks. |
| DF-09 | Advanced achievement engine and extensive sound | Optional polish after core scoring, accessibility, and reliability. |
| DF-10 | Multi-weekend leagues/public spectator mode | Requires different tenancy/privacy/product model. |
| DF-11 | Cross-device guest account recovery | Anonymous auth minimizes friction; linking/upgrade may be considered after participant-claim policy is proven. |

## 9. Change-control rule

Any change to scoring, qualification, reveal privacy, address access, roles, published/private path classification, or the Saturday itinerary requires:

1. organizer approval;
2. update to the relevant Phase 0 document and this register;
3. migration/recalculation impact analysis for existing data;
4. Security Rules and test updates where applicable;
5. an audited administrative operation if live data changes.

Visual copy and minor layout changes do not require an architecture decision unless they expose protected information, change accessible meaning, imply a new state transition, or contradict the approved itinerary/rules.
