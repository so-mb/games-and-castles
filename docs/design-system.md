# Design system

## 1. Design intent

Games & Castles should feel like a premium European travel journal that becomes an energetic arcade tournament when play begins, with warm celebration moments and the clarity of a private group dashboard. The visual language is dark and warm, tactile rather than futuristic, playful without becoming childish, and cinematic without hiding practical information.

The system uses three modes within one coherent page:

- **Editorial light:** warm cream surfaces for itinerary, trip context, and readable long-form details.
- **Championship dark:** midnight/charcoal surfaces for competitions, brackets, score entry, and leaderboard drama.
- **Celebration focus:** darkened full-screen presentation with restrained gold/red accents and one bright active-state color.

No visual treatment may hint at the subject of the protected special reveal. Locked art, iconography, filenames, and animation remain neutral.

## 2. Design tokens

Token names express purpose rather than a particular component. Final color values require automated contrast checks against their intended foreground/background pairs.

### 2.1 Color

| Token | Initial value | Use |
|---|---:|---|
| `color-night-950` | `#090E18` | Full-page dark backdrop/presentation |
| `color-night-900` | `#0F1726` | Championship section background |
| `color-night-800` | `#182338` | Elevated dark cards |
| `color-cream-50` | `#FFF9EC` | Highest light surface |
| `color-cream-100` | `#F6EEDC` | Editorial section background |
| `color-cream-200` | `#E8DCC5` | Light borders/dividers |
| `color-prague-red-600` | `#9E3038` | Travel emphasis, primary light-surface action |
| `color-prague-red-700` | `#7E252C` | Pressed/strong state |
| `color-antique-gold-400` | `#D2B06A` | Celebration, podium, premium highlight |
| `color-antique-gold-600` | `#9D7940` | Gold text/border on light surfaces |
| `color-electric-cyan-400` | `#36D6D0` | Active match, live synchronization, focus on dark |
| `color-electric-lime-400` | `#B9EF63` | Optional secondary game accent; do not mix indiscriminately with cyan |
| `color-ink-900` | `#211B18` | Primary text on cream |
| `color-ink-600` | `#665D56` | Secondary text on cream |
| `color-paper-50` | `#FFF9ED` | Primary text on dark |
| `color-paper-300` | `#C5C1B8` | Secondary text on dark |
| `color-success-500` | `#48B985` | Confirmed/success with icon and text |
| `color-warning-500` | `#E8AD4F` | Warning/attention with icon and text |
| `color-error-500` | `#E66668` | Error/destructive with icon and text |
| `color-info-500` | `#48A9E6` | Informational state |

Semantic aliases select the correct base token per surface:

```text
surface.page.dark       = night-950
surface.section.dark    = night-900
surface.card.dark       = night-800
surface.section.light   = cream-100
surface.card.light      = cream-50
text.primary.dark       = paper-50
text.secondary.dark     = paper-300
text.primary.light      = ink-900
text.secondary.light    = ink-600
action.primary.dark     = electric-cyan-400
action.primary.light    = prague-red-600
focus.ring.dark         = electric-cyan-400
focus.ring.light        = prague-red-700
```

Color never acts alone: every live/locked/warning/win/loss state also has a label and icon or structural difference. Gold is an accent, not body text on cream. Red is not used for ordinary decoration beside error messages without another cue.

### 2.2 Typography

| Role | Recommended character | Mobile size/line height | Desktop size/line height |
|---|---|---:|---:|
| Hero display | Expressive editorial serif, e.g. Fraunces; fallback Georgia, serif | 44/46 | 72/72 |
| Section display | Same editorial serif | 32/38 | 48/54 |
| Card title | Interface sans, 650–700 weight | 20/26 | 22/28 |
| Body | Highly legible sans, e.g. Inter; fallback system UI | 16/24 | 17/26 |
| Compact UI | Interface sans | 14/20 | 14/20 |
| Label/eyebrow | Interface sans, 650, modest tracking | 12/16 | 12/16 |
| Score numeral | Tabular interface/mono numerals, 700–800 | 28/32 | 36/40 |
| Hero score | Tabular numerals | 40/44 | 56/60 |

Use at most two font families. “Arcade” comes from weight, tabular figures, controlled uppercase labels, motion, and graphic framing—not hard-to-read pixel fonts. Avoid uppercase paragraphs. Enable `font-variant-numeric: tabular-nums` for times, scores, ranks, and countdown-like values. Font loading must use a robust fallback and avoid invisible text.

### 2.3 Spacing

A 4 px base unit supports dense score UI and spacious editorial layouts.

| Token | Value | Typical use |
|---|---:|---|
| `space-0` | 0 | Reset |
| `space-1` | 4 px | Icon/text micro-gap |
| `space-2` | 8 px | Compact control gap |
| `space-3` | 12 px | Chip/card internal gap |
| `space-4` | 16 px | Mobile card padding |
| `space-5` | 20 px | Form grouping |
| `space-6` | 24 px | Card padding/stack gap |
| `space-8` | 32 px | Subsection separation |
| `space-10` | 40 px | Mobile section rhythm |
| `space-12` | 48 px | Major group separation |
| `space-16` | 64 px | Mobile section padding |
| `space-24` | 96 px | Desktop section padding |

Content gutters: 16 px at narrow widths, 24 px from 640 px, and 32 px from 1024 px. Long editorial text uses a maximum readable width near 68 characters; dashboards may use a 1200 px maximum container.

### 2.4 Radius, border, and shadow

| Token | Value | Use |
|---|---:|---|
| `radius-sm` | 8 px | Chips, compact controls |
| `radius-md` | 12 px | Inputs, buttons |
| `radius-lg` | 18 px | Cards |
| `radius-xl` | 28 px | Day cards, feature panels |
| `radius-full` | 9999 px | Avatar/status dot shells |

Borders are generally 1 px with low-contrast surface-specific colors. A 2 px border denotes selection/current state; a 3 px outline is reserved for focus and must remain outside the component.

| Shadow | Definition intent | Use |
|---|---|---|
| `shadow-resting` | Soft, short warm-black ambient shadow | Light cards |
| `shadow-elevated` | Medium ambient + small key shadow | Dialogs, sticky controls |
| `shadow-glow-live` | Low-opacity cyan outer glow | One current/live element only |
| `shadow-gold-focus` | Warm, restrained halo | Podium/reveal moment only |

Dark cards rely primarily on contrast and borders, not multiple heavy glows. Shadows must not be required to perceive boundaries in high contrast or reduced-transparency contexts.

## 3. Layout and section transitions

- The page alternates editorial light and championship dark in large, intentional bands rather than checkerboarding every card.
- Transitions can use a shallow paper edge, ruled divider, map-line curve, or color fade. They must not create false click targets.
- The hero may layer a dark gradient over Prague imagery; itinerary begins on cream; championship returns to dark; private/reveal sections use dark neutral vault surfaces; trip information ends in editorial light.
- Anchor targets include scroll margin for sticky navigation. The sticky navigation shows text or accessible labels for section icons and collapses to a compact horizontally scrollable control on mobile.
- Use CSS Grid/Flexbox reflow, not fixed-position desktop canvases. Avoid horizontal page overflow.

## 4. Component patterns

### 4.1 Cards

| Variant | Surface and structure | Content |
|---|---|---|
| Editorial | Cream/white, subtle warm border, optional paper texture at very low opacity | Itinerary, trip notes, Friday activity cards |
| Championship | Night-800, cool border, high-contrast score/status header | Competition, match, standing, score breakdown |
| Live | Championship plus 2 px cyan edge and “Live” chip | Exactly the current match/session |
| Celebration | Night background, gold accent, spacious composition | Podium, birthday publication |
| Locked | Neutral dark, shield/lock icon, concise status, no suggestive illustration | Birthday Vault and special reveal before publication |
| Destructive summary | Neutral surface with error border only around impact list | Reset/reopen confirmation |

Clickable cards have a clear action label or chevron, visible hover/focus, and a minimum touch target. Static cards must not mimic buttons.

### 4.2 Buttons

- **Primary:** filled red on light surfaces or filled cyan/dark-ink on dark surfaces; one dominant action per region.
- **Secondary:** surface fill with visible border and high-contrast text.
- **Quiet:** text/icon action for low-risk utilities such as copying a safe note or replaying animation.
- **Destructive:** error color plus explicit verb (“Reset fixtures”), never a generic “Continue.” Confirmation describes affected results and scores.
- **Presentation:** large, high-contrast, remote-friendly control visible only to organizers outside audience mode.

All variants define default, hover, active, focus-visible, disabled, and pending states. Disabled buttons include nearby explanation when the reason is not obvious. Pending buttons retain width, use an inline spinner, and prevent duplicate activation.

### 4.3 Form controls

- Persistent top-aligned labels; placeholders only demonstrate format.
- Input height at least 44 px; textareas show remaining character count near limits.
- Help text precedes error text in reading order. Errors include an icon, concise correction, and `aria-describedby` association.
- Radio cards are suitable for neutral `option-a`/`option-b` predictions; checked state uses indicator, border, label, and screen-reader state.
- Score entry uses explicit participant labels, minus/plus only as optional helpers, and a visible numeric value. Provide a final result summary before save.
- Organizer configuration groups format, participant snapshot, series, scoring, draw, and confirmation into short steps while preserving reviewability.
- Never auto-submit a result, lock, reset, or reveal when a select/radio value changes.

### 4.4 Status chips

Chips pair icon/shape and text, for example:

| State | Label | Visual cue |
|---|---|---|
| Live | `Live` | Cyan dot/ring with reduced-motion static alternative |
| Scheduled | `Up next` | Clock icon, neutral border |
| Complete | `Final` | Check icon, success treatment |
| Locked | `Locked` | Lock icon, neutral/gold edge |
| Syncing | `Syncing` | Rotating arrows unless reduced motion |
| Offline | `Offline` | Cloud-off icon and timestamp |
| Corrected | `Corrected` | History icon; link to safe change context |
| Free attraction | `Free` | Ticket/check icon and label |

Avoid ambiguous dots with no text in primary status displays.

## 5. Feature-specific patterns

### 5.1 Hero

Use one strong Prague travel image/illustration with a protective gradient for text. The title and complete **31 July–2 August 2026** range lead; Germany-to-Prague context and playful tagline follow. Birthday acknowledgement is a small warm line, not the dominant headline. When scoring starts, a compact leader card shows avatar, name, crown, points, tie wording when needed, and a “Why these points?” link.

### 5.2 Weekend overview

Friday's card uses an unordered tile cloud/list and an “Any order” chip; no times or vertical connector. Saturday's card uses a mini route/timeline and next fixed booking. Sunday's compact card links to a simple three-group departure board: first by 08:50, second by 09:00, and third by 09:20, all from Prague (Central Bus Station Florenc). It contains no invented group members, onward destinations, or activity list. The structural contrast communicates flexibility and scheduling without relying on color.

### 5.3 Timeline

- Semantic ordered list with a continuous rule, time column, marker, title, and details.
- Mobile stacks the time above the title; desktop may use a 120–160 px time rail.
- Current item uses a labeled marker; completed/planned states remain distinguishable without fading text below accessible contrast.
- Fixed bookings use a ticket icon and stronger frame. Flexible/optional items use dashed outline and “Optional.”
- Free tourist attractions have a consistent `Free` chip. Transport/dinner/cinema do not receive that chip.
- Delay guidance appears as an actionable priority note: museum first to shorten/skip; Kampa before Charles Bridge; preserve fixed reservations.

### 5.4 Bracket

- Dark canvas with round columns, 16–20 px connector strokes, and high-contrast match cards.
- Participant slots show avatar/initial, display name, seed/source, and score. Winner uses check/crown plus weight; loser remains legible.
- Current round is focused on mobile; adjacent rounds are reachable with labeled tabs or a contained horizontal scroller.
- Connector animation runs only once on progression and becomes instantaneous under reduced motion.
- Provide an equivalent ordered list/table: round, match, participants, result, advancement. The bracket graphic is not the sole representation.

### 5.5 Leaderboard and podium

- Podium orders second, first, third visually on wide screens but preserves logical DOM reading order as first, second, third.
- First place uses crown/gold; second and third use distinct labels/material tones. All positions show numeric rank.
- Full rankings use tabular points, tied-rank labels, movement only when meaningful, and a disclosure for point breakdown.
- A breakdown groups ledger entries by competition/source with points and human-readable reason. Negative/void corrections are clearly labeled rather than silently disappearing from history where policy exposes them.

### 5.6 Locked content

Use a neutral lock/shield or abstract vault dial, softly lit dark surface, status text, permitted action, and count where allowed. Do not use silhouettes, thematic props, color coding, copy, alt text, animation paths, or media metadata that could suggest protected content. A lock opening animation communicates authorization/publication only.

### 5.7 Full-screen presentation

- Use safe-area padding, large type, high contrast, and a clearly reachable exit for the organizer.
- Audience mode hides admin controls and private data; browser back/escape exits without changing published state.
- Reveal sequence has explicit intro, content, and settled states. Reload enters the settled published state; “Replay” re-runs local animation only.
- Never auto-play sound. Provide sound toggle before presentation and a visible muted state.

## 6. Iconography, illustration, and photography

### Iconography

Use Lucide icons at consistent 1.75–2 px stroke. Icons supplement labels for critical actions. Core motifs: trophy/crown for rankings, crossed game-neutral shapes or spark for competition, map pin/train/castle outline for travel, lock/shield for protected areas, history for corrections, cloud state for synchronization. Avoid game-specific logos and special-reveal hints.

### Illustration

Preferred illustration combines inked travel-sketch lines, simplified Prague rooflines/castle silhouettes, ticket/stamp shapes, subtle grid/scoreboard geometry, and restrained confetti. Keep details behind text low contrast. Decorative illustrations use empty alt text; informative maps/route graphics need equivalent text.

### Photography

- Favor atmospheric Prague city/architecture imagery with warm highlights and deep blue shadows.
- Apply one consistent film-grain/duotone grade; keep grain subtle enough not to reduce text legibility.
- Use licensed assets with recorded attribution requirements. Remove unnecessary EXIF/location metadata before shipping.
- Crop responsively with art direction so landmarks and faces are not obscured by text.
- Never embed the exact accommodation or protected reveal subject in an image, filename, alt text, or metadata.

## 7. Motion and gamification

Motion has a purpose: confirm state change, focus attention, explain progression, or celebrate a terminal moment.

| Effect | Trigger | Limits |
|---|---|---|
| Match status pulse | Newly live match | Subtle; stops after a few cycles or stays static |
| Bracket connector draw | Confirmed advancement | Once per new event; no continuous traveling glow |
| Point count-up | Newly acknowledged score change | ≤ 600 ms; final number available immediately to assistive tech |
| Group draw | Organizer-confirmed presentation | Names settle clearly; persisted draw shown afterward |
| Podium reveal | Competition/weekend completion | Staged but skippable |
| Achievement badge | First view of earned optional achievement | Small and nonblocking |
| Vault opening | Publication state transition/replay | Neutral; no content hint |
| Win celebration | Newly completed match/session with a canonical winner | Small avatar crown and controlled burst; panel remains until dismissed, never replayed from initial history |
| Confetti | Major reveal or final winner | Controlled burst, ≤ 2 seconds, never over score entry |

Recommended motion tokens:

- `motion-fast`: 120 ms for press/focus feedback.
- `motion-standard`: 220 ms for panels and status change.
- `motion-emphasis`: 450–650 ms for progression.
- `motion-celebration`: up to 1200 ms for staged reveal; skippable.
- Easing: standard ease-out for entrances, ease-in for exits, spring only for small celebratory objects.

Under `prefers-reduced-motion: reduce`, remove parallax, count-up interpolation, connector drawing, shuffling paths, pulsing, and confetti. Crossfade or instantly settle while preserving all state labels. Animation must not block score entry, navigation, or access to itinerary. Sound is disabled by default and never contains essential information.

Participant avatars use a bounded, Rules-validated set of recognizable Lucide motifs spanning travel, games, fantasy, animals, and playful technology. Winner meaning is never conveyed by motion or color alone: completed result cards retain a textual result and a crown-labelled avatar, while a dismissible live-region panel announces the winner and remains available until its labelled close control is used. The private participant variant may say **You won!** or **Your team won!** only when the signed-in participant ID is present in the authoritative winning entity.

Fun player titles and achievements must be opt-out-ready, kind, and based on transparent non-sensitive events. Avoid labels implying incompetence, intoxication, personal traits, or protected characteristics.

## 8. Responsive behavior

| Width | Behavior |
|---|---|
| 320–479 px | Single column; 16 px gutter; stacked timeline; compact sticky nav; focused bracket round; bottom-sheet dialogs where appropriate |
| 480–767 px | Single column with paired compact stats; larger day-card imagery; score controls remain thumb reachable |
| 768–1023 px | Two-column day cards/dashboard modules; timeline time rail; bracket can show two rounds |
| 1024–1279 px | 12-column grid; standings + active match side by side; full organizer panels |
| ≥1280 px | Max-width container; generous negative space; no uncontrolled stretching of text/cards |

Breakpoints are content-driven; the numeric table is the initial Tailwind mapping, not permission to force desktop composition. Test 200% zoom and text reflow. Orientation changes must not discard forms or replay effects.

## 9. Empty, loading, synchronization, and error states

### Empty

- No competitions: explain that an organizer can create the first event; guests see a friendly “Games begin soon.”
- No scores: show zero-state podium placeholders without inventing a leader.
- No recent activity: concise neutral copy, no fake entries.
- No published birthday messages/reveal: locked state and permitted action/count only.
- No itinerary item currently active: show next planned item or “Schedule complete,” not a blank card.

### Loading

Use skeletons shaped like final content only for initial loads. Keep the itinerary/static shell visible when realtime data loads. Skeletons do not pulse under reduced motion. After a reasonable delay, replace indefinite skeletons with an explanatory retry state.

### Synchronization

- `Connecting`: initial realtime handshake.
- `Syncing`: acknowledged local action awaiting authoritative state.
- `Up to date`: usually quiet; may show last sync in details.
- `Offline — may be out of date`: persistent banner with cloud-off icon and last successful sync.
- `Conflict`: admin-specific panel showing current revision, safe summary, reload/review action; never silently overwrite.

Do not fire confetti or reveal animations merely because historical published data arrived after reconnect.

### Errors

- Write plain-language outcome first, recovery action second, optional diagnostic code last.
- Authentication errors offer retry/sign-in without exposing whether a protected code or resource exists.
- Validation errors stay near fields and preserve entered values.
- Permission errors distinguish “sign in,” “organizer access required,” and “state changed” only when safe.
- Destructive/partial-operation errors point organizers to audit/operation status and block unsafe retry until the current persisted revision confirms whether the request was applied.
- Never render raw Firebase errors, stack traces, database paths, protected values, or function payloads to guests.

### Phase 10 operational states

- Organizer session expiry uses a focused modal during the final five minutes, with plain remaining-time copy, **Stay signed in**, and **Sign out now**. It must not resemble a reveal or celebration.
- Operations uses the existing dark organizer surface, compact definition-list rows, text-plus-badge status, and no charts or fake telemetry. Diagnostics are read-only and remain usable at 320 px.
- The deployed-update notice is a small persistent status card with one explicit reload action. It never reloads automatically or competes with an offline message at the same screen position.
- App Check `disabled`, `invalid`, `degraded`, `ready`, and `unknown enforcement` states are written out; color is secondary and no token or raw provider error is shown.

### Phase 11 interaction polish

- Shared buttons render icons, labels, and optional arrows as direct horizontal flex items. Icons do not shrink, labels use a consistent line height, and state transitions are limited to color, surface, border, shadow, and transform.
- Modal focus initializes once per opening. Controlled input updates and changing callback identities must not restart the focus trap or move focus away from the active field.
- Organizer session actions are grouped separately from workspace navigation. Workspaces remain in one compact tab rail with internal horizontal scrolling at narrow widths instead of wrapping into a dense button wall.
- Modal entrance motion is short and non-blocking. The existing `prefers-reduced-motion` override reduces it with every other nonessential transition.

## 10. Accessibility verification checklist

- WCAG AA contrast checked for every token pair and interactive state.
- Heading/landmark structure remains coherent across one page.
- Skip link, anchor focus management, dialog focus trap/return, and escape behavior verified.
- All flows complete with keyboard and common mobile screen readers.
- 44 px touch targets, sufficient adjacent spacing, and no gesture-only action.
- Bracket, charts, podium, route art, and animations have equivalent text.
- Color-blind simulations preserve status meaning.
- 200% zoom and 320 px reflow have no lost content or page-level horizontal scroll.
- Live-region announcements are concise and do not announce every leaderboard rerender.
- Reduced-motion behavior and sound-off default verified in automated/manual tests.
