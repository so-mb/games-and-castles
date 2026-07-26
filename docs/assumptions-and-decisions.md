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
| CR-01 | GitHub Pages hosts only the static frontend. | Pages has no trusted server runtime. Authentication, shared state, authorization, protected operations, and secrets belong in Firebase/Google Cloud. Client assets are always inspectable. |
| CR-02 | Firebase Realtime Database is the shared-state store. | The product has modest, tree-shaped live state and needs fast updates across phones for matches, standings, participant lists, counts, and publication. RTDB listeners and atomic multi-location writes fit this event-oriented weekend better than polling. Data must be denormalized carefully and listeners scoped. |
| CR-03 | Guests use Firebase Anonymous Authentication. | It gives each device a UID for ownership/rules without adding account-creation friction during a private weekend. It does not prove identity and needs a participant-link/duplicate policy. |
| CR-04 | Organizers use persistent sign-in and a Firebase custom claim. | A server-issued claim is enforceable in Rules/functions. The only role check is `auth.token.admin === true`; display names, emails in client code, PIN UI, or database booleans do not authorize. |
| CR-05 | The application is mobile-first. | Participants primarily use phones during travel and live play. It affects content order, touch targets, score entry, bracket views, connectivity feedback, and performance budgets. Desktop remains important for organizer/presentation use. |
| CR-06 | Competition formats are generic. | User-entered game names remain data, allowing different games without engine forks or trademark-specific rules. Only the three exact format identifiers select behavior. |
| CR-07 | Overall totals are ledger-derived. | Individual entries make scoring explainable, idempotent, correctable, auditable, and rebuildable. A manually incremented total drifts under retries/corrections and cannot explain points. |
| CR-08 | Individual round wins contribute to the overall championship. | Close losses still contribute and individual series rounds matter. These awards are separate from standings table points and configurable per competition. |
| CR-09 | Confirmed fixture and group orders are persisted once. | All devices must share one official draw/order. Regenerating on render/reconnect creates disagreement and can erase the meaning of existing results. Reset is explicit, destructive, and audited. |
| CR-10 | Result correction triggers full affected recalculation. | Standings, qualification, bracket dependencies, score entries, leaderboard, and read caches must reflect the authoritative corrected result. Adding manual compensation alone would leave invalid derived state. |
| CR-11 | Sensitive reveal content is backend-only before publication. | Anything in React, Vite variables, public database paths, CSS, source maps, logs, examples, names, or repository history can be inspected. Cloud Functions must authorize, verify protected conditions, publish, and resolve. |
| CR-12 | Prediction scoring is backend-controlled and idempotent. | Clients cannot know/decide the protected outcome authoritatively. The key `prediction:{eventId}:{participantId}` ensures retries never award twice. |
| CR-13 | Public accommodation information is limited to `Žižkov, Prague 3`; the exact address is excluded from the static application and repository. | A hidden frontend button is not security. The exact address must not appear in client data, mock data, public examples, or commits. A later authenticated implementation may retrieve it from restricted Firebase data after separate authorization review. |
| CR-14 | Private birthday submissions are not downloaded to other guests. | Security must be path/rule/function based, not client filtering. Publication creates a separate approved snapshot; count is a trusted aggregate. |
| CR-15 | The first implementation vertical slice prioritizes `round-robin-knockout`. | It exercises the shared hard parts early: generation, persistence, series, standings, tiebreaks, brackets, round scoring, corrections, audit, and live synchronization. Later formats reuse those primitives. |
| CR-16 | Animation is controlled and secondary to usability. | Important moments benefit from motion, but score entry/itinerary access must stay fast. Reduced motion is respected; sound is off by default; no constant distracting animation. |
| CR-17 | Development and production use separate Firebase projects. | This prevents test identities, claims, synthetic reveals, permissive experimentation, and data migrations from affecting the live weekend. |
| CR-18 | Saturday, 1 August 2026 follows the approved itinerary and priorities. | The document must preserve the planned timeline, mark all tourist attractions free, shorten/skip the museum first if delayed, skip Kampa before reducing Charles Bridge, and protect fixed dinner/cinema bookings. |
| CR-19 | The displayed trip range is 31 July–2 August 2026. | Friday, 31 July is flexible Game Night in Germany with no fixed times; Saturday, 1 August is the scheduled Prague Quest; Sunday, 2 August is departure and onward travel only, with no invented itinerary. |
| CR-20 | Phase 2 organizer sign-in uses Firebase Email/Password Authentication with no public sign-up or password-reset flow. | Authorization still comes only from `auth.token.admin === true`; an authenticated email alone grants nothing. Initial users and claims are provisioned out of band. |
| CR-21 | Phase 2 guest identity is browser-local and has no recovery or cross-device claim flow. | Anonymous Auth persistence keeps continuity in the same browser. Clearing storage or changing browser/device may create a new UID; display names are never accepted as ownership proof. |
| CR-22 | Safe static itinerary content renders independently of Firebase authentication and configuration. | Live participant reads require Authentication, while missing/broken configuration is isolated to the live feature area. |
| CR-23 | Production Pages builds receive the six public Firebase web-configuration values through GitHub Actions repository variables, with emulator mode disabled. | Public Firebase client configuration is expected to be browser-visible and is not a secret. Repository variables keep environment configuration out of source control; service credentials remain prohibited. The Phase 2 production deployment is configured and successfully connected to Firebase. |

## 3. Required terminology

| Domain identifier | Friendly UI label | Notes |
|---|---|---|
| `round-robin-knockout` | Merry-Go-Round | Complete single round robin, then configurable knockout |
| `all-hands` | All Hands | One or more simultaneous individual/team sessions |
| `group-knockout` | Group Format | Balanced randomized groups, internal round robin(s), then knockout |
| `specialReveal` | Context-dependent neutral label | Neutral in paths/code/docs; never encode protected subject |
| `predictionEvent` | Prediction event | Selections stored only as `option-a` / `option-b` |
| `revealSequenceB` | Optional neutral implementation label | Use only if a second neutral sequence identifier is necessary |

Do not create aliases for the format identifiers in persisted data. Friendly labels belong only at the presentation boundary.

## 4. Recommended defaults

| ID | Default | May be changed by | Reason |
|---|---|---|---|
| RD-01 | Round-robin table points: win 3, loss 0, supported draw 1 | Organizer before competition start | Familiar qualification model, separate from weekend points |
| RD-02 | Championship: match win 2, individual round win 1 | Organizer before start | Rewards both overall result and round performance |
| RD-03 | Completed-match participation bonus 0/off | Organizer before start | Avoids inflating totals unless participation is intentionally rewarded |
| RD-04 | Correct prediction 3 championship points | Organizer before event opens | Meaningful but bounded contribution; backend-awarded |
| RD-05 | Six-player Merry-Go-Round qualifies top four: 1v4, 2v3, final, optional third place | Organizer in competition config | Clear seeded structure after complete league play |
| RD-06 | Six-player Group Format uses two groups of three, top two, A1vB2/B1vA2 | Organizer in competition config | Balanced groups and cross-group semifinals |
| RD-07 | Automatic groups: 4–5 one; 6–8 two; 9–12 three; 13–16 four | Organizer may choose validated manual count | Keeps groups practical and within one participant in size |
| RD-08 | All Hands tied placements share the declared place's configured points | Organizer before session/competition starts | Easiest to explain; avoids implicit fractional rounding |
| RD-09 | Team award policy is `each-member` | Organizer before session | Clear and celebratory; displayed award explains per-member points |
| RD-10 | Overall equal totals share rank (`1, 1, 3`) | Fixed unless product spec changes | No hidden weekend tiebreak was approved |
| RD-11 | Locked prediction aggregate remains hidden until reveal | Organizer/event policy | Preserves surprise and avoids social influence |
| RD-13 | Birthday publication is a snapshot; replay is client-only | Fixed implementation behavior | Moderation remains stable and animation cannot duplicate writes |
| RD-14 | Cryptographic Fisher–Yates shuffle plus circle method | Fixed technical behavior | Unbiased initial order and proven complete pairings |
| RD-15 | Persist voided score entries instead of silently deleting them | Technical implementation unless retention policy requires removal | Supports audit and correction explanation while totals filter to active entries |
| RD-16 | User sound is off by default | User can opt in | Avoids surprise/disruption and meets the brief |

Defaults are copied into the relevant event/competition record and frozen when play/event state begins. Changing a default later does not rewrite historical competitions.

## 5. Open organizer and implementation decisions

These items require confirmation; recommendations indicate the least-risk starting point.

| ID | Decision required | Recommendation | Needed before |
|---|---|---|---|
| OD-05 | Set maximum active participants, competitions, message lengths/counts, sessions, groups, and custom fields. | Use conservative UI/rules/function limits based on the private group size and load-test at twice expected volume. | Phases 2–3 |
| OD-06 | Decide whether match draws are needed and their maximum-round rule. | Off by default; enable only per competition with explicit draw condition and 1 table point default. | Phase 3 |
| OD-07 | Confirm multi-person head-to-head tie behavior. | Use a tied-set mini-table; if unresolved, continue global published tiebreak order and finally organizer decision. | Phase 4 |
| OD-08 | Define valid nonstandard even knockout qualifier counts and bracket-bye seeding. | Offer top 2/4/8 by default; allow other counts only after a preview shows all byes/seeds and tests cover them. | Phase 4 |
| OD-09 | Decide whether organizer-decided final tiebreak awards any additional championship point. | No additional points unless a separate configured `qualification`/`competition-win` rule exists. | Phase 4 |
| OD-10 | Define All Hands custom field limits and whether free text is needed. | Prefer numbers/booleans and short allowlisted labels; avoid arbitrary rich text/scoring formulas. | Phase 5 |
| OD-11 | Choose automatic group policy outside 4–16 participants and whether snake assignment is used. | Require a validated manual group count outside the specified range; use deterministic round-robin assignment after secure shuffle. | Phase 6 |
| OD-12 | Decide voided/corrected ledger visibility to guests. | Show clear correction activity and current breakdown; keep detailed before-values organizer-only if confusing/private. | Phase 7 |
| OD-13 | Set Birthday Vault per-UID message count, edit window, moderation/edit policy, anonymous display wording, and retention/deletion period. | One editable submission per UID until closed; organizer hides but does not rewrite guest text; publish a sanitized snapshot; decide deletion after the event. | Phase 8 |
| OD-14 | Decide whether organizers may view individual predictions before reveal and whether aggregate distribution publishes afterward. | Do not surface individual choices unless operationally necessary; hide aggregate until reveal; publish aggregate only if approved. | Phase 9 |
| OD-15 | Supply safe dynamic option labels and determine exactly when they become guest-readable. | Content-review them before entering any client-readable path; keep stored values neutral. | Phase 9 content freeze |
| OD-16 | Choose the protected reveal condition/code lifecycle, attempt limit, and authorized function operators. | Secret Manager value, callable verification, low attempt limit/alert, rotation after use; never share through repository/chat logs. | Phase 9 |
| OD-18 | Set production App Check enforcement date and supported devices/browsers. | Monitor during staging/rehearsal, then enforce before production with an organizer recovery path. | Phase 10 |
| OD-19 | Approve data retention, export, privacy deletion, backup, and audit-log periods. | Minimize private content after the event; retain only safe audit metadata required for recovery/explanation. | Phase 10 |
| OD-20 | Confirm performance budgets and whether remote webfonts/photography are acceptable. | Self-host/subset at most two fonts where licensing allows; mobile-first optimized imagery; define budgets during Phase 1. | Phase 1/11 |
| OD-21 | Recheck the planned Prague transport route and opening/access conditions close to travel. | Preserve the approved itinerary in the app, but perform a current authoritative check before deployment/travel and update only with organizer approval. | Phase 11 rehearsal |
| OD-22 | Confirm cinema booking display details and whether any booking reference may be shown. | Show only the approved venue/time/screening description; keep booking references out of public data. | Phase 1/11 copy freeze |

The Phase 2 production baseline, including initial organizer-account ownership and provisioning, is complete. OD-13, OD-15, OD-16, OD-18, and OD-19 remain blockers for their named later features and final full-product production readiness; they do not block the completed Phase 2 participant foundation. Other decisions block only the named feature or phase.

## 6. Technical architecture decisions

### AD-01 — Static frontend, managed backend

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

**Decision:** Private/prepublication content is copied by a trusted function into a separate sanitized public snapshot only at publication.

**Reason:** Toggling a boolean beside already-public data does not prevent prior reads/downloads.

**Consequences:** Publication is an idempotent backend workflow; presentation replay reads the snapshot without mutation.

### AD-06 — Revision-based multi-admin control

**Decision:** Privileged mutations include expected revisions and idempotent request IDs.

**Reason:** Last-write-wins can erase another organizer's result or lock state.

**Consequences:** Conflicts require explicit UI; backend transactions and audit records are mandatory for consequential changes.

### AD-07 — Phase 1 is a typed, anchor-based static shell

**Decision:** Use a single React/Vite page with native anchors, Intersection Observer active-section tracking, Tailwind-backed CSS tokens, typed static content modules, Lucide icons, CSS decoration, and preview-labelled mock championship data. Configure Vite with the fixed `/games-and-castles/` GitHub Pages base path.

**Reason:** The product has one documented page flow and does not need a routing dependency or server rewrite. Typed data can later be replaced by Firebase-backed adapters without embedding trip content in large JSX components. CSS and icon-based artwork keeps the Phase 1 bundle lightweight and avoids remote image, font, licensing, and privacy risks.

**Consequences:** Phase 1 contains no persistence or trusted behavior. Birthday, prediction, result, leaderboard, and reveal controls remain disabled or explicitly presentation-only. A future change to the repository name or hosting path requires updating the Vite base configuration and deployment test.

### AD-08 — Isolated guest and organizer Firebase clients

**Decision:** Use the default Firebase app for anonymous guest Auth/RTDB and a named Firebase app for persistent organizer Email/Password Auth/RTDB.

**Reason:** Firebase Auth supports one current user per Auth instance. A shared instance would replace and potentially lose the browser's anonymous guest session when an organizer signs in on the same device.

**Consequences:** Both clients use the same public project configuration and Rules, but their Auth persistence and database requests carry independent ID tokens. Organizer sign-out returns the organizer surface to signed-out state without changing the guest UID.

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
4. Security Rules/function/test updates where applicable;
5. an audited administrative operation if live data changes.

Visual copy and minor layout changes do not require an architecture decision unless they expose protected information, change accessible meaning, imply a new state transition, or contradict the approved itinerary/rules.
