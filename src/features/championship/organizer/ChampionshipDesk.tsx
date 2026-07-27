import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { useParticipants } from "../../participants/ParticipantsProvider";
import { useChampionship } from "../ChampionshipProvider";
import type {
  ManualChampionshipBonus,
  ReconciliationItem,
} from "../domain/types";

const labels = {
  "in-sync": "In sync",
  missing: "Missing source",
  stale: "Stale source",
  orphaned: "Orphaned source",
  "malformed-run": "Malformed run",
  "malformed-source": "Malformed source",
  unsupported: "Unsupported state",
  "not-expected": "No ledger expected",
} as const;

function SyncCard({
  item,
  busy,
  onReconcile,
  onRemove,
}: {
  item: ReconciliationItem;
  busy: boolean;
  onReconcile: () => void;
  onRemove: () => void;
}) {
  const actionable = ["missing", "stale"].includes(item.status);
  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold">{item.competitionTitle}</p>
          <p className="mt-1 text-xs text-white/45">
            {item.expected
              ? `Runtime r${item.expected.meta.runRevision} · ${item.expected.meta.entryCount} expected entries`
              : "No safe expected snapshot"}
            {item.entryDelta
              ? ` · ${item.entryDelta > 0 ? "+" : ""}${item.entryDelta} entry change`
              : ""}
          </p>
        </div>
        <StatusBadge
          tone={
            item.status === "in-sync"
              ? "live"
              : item.status === "not-expected"
                ? "neutral"
                : "warning"
          }
        >
          {labels[item.status]}
        </StatusBadge>
      </div>
      {item.warning ? (
        <p className="mt-3 text-xs leading-5 text-white/55">{item.warning}</p>
      ) : null}
      {actionable ? (
        <Button
          className="mt-3"
          disabled={busy}
          onClick={onReconcile}
          variant="dark"
        >
          <RefreshCw aria-hidden="true" size={15} />
          Reconcile source
        </Button>
      ) : item.status === "orphaned" ? (
        <Button
          className="mt-3"
          disabled={busy}
          onClick={onRemove}
          variant="quiet"
        >
          <Trash2 aria-hidden="true" size={15} />
          Remove orphan…
        </Button>
      ) : null}
    </li>
  );
}

export function ChampionshipDesk() {
  const championship = useChampionship();
  const participants = useParticipants();
  const [participantId, setParticipantId] = useState("");
  const [points, setPoints] = useState("");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmBonus, setConfirmBonus] =
    useState<ManualChampionshipBonus | null>(null);
  const [confirmOrphan, setConfirmOrphan] = useState<ReconciliationItem | null>(
    null,
  );
  const [bonusFilter, setBonusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const counts = useMemo(
    () =>
      championship.reconciliation.reduce<Record<string, number>>(
        (result, item) => ({
          ...result,
          [item.status]: (result[item.status] ?? 0) + 1,
        }),
        {},
      ),
    [championship.reconciliation],
  );
  const reconcilable = championship.reconciliation.filter((item) =>
    ["missing", "stale"].includes(item.status),
  );
  const filteredBonuses = championship.organizerBonuses.filter(
    (bonus) => bonusFilter === "all" || bonus.participantId === bonusFilter,
  );
  const names = new Map(
    participants.organizerParticipants.map((participant) => [
      participant.id,
      participant.displayName,
    ]),
  );

  async function perform(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage(success);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The operation failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="championship-sync-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <StatusBadge tone={reconcilable.length ? "warning" : "live"}>
              {reconcilable.length
                ? `${reconcilable.length} sources need action`
                : "All valid sources synchronized"}
            </StatusBadge>
            <h2
              className="font-display mt-3 text-3xl font-semibold"
              id="championship-sync-title"
            >
              Championship Sync
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
              Preview and replace complete ledger sources from authoritative
              runs. Competition awards cannot be edited here.
            </p>
          </div>
          <Button
            disabled={
              !championship.canMutate || busy || reconcilable.length === 0
            }
            onClick={() =>
              void perform(
                () => championship.reconcileAll(),
                `${reconcilable.length} valid sources reconciled.`,
              )
            }
            variant="dark"
          >
            <RefreshCw aria-hidden="true" size={16} />
            Reconcile all ({reconcilable.length})
          </Button>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Competitions", championship.reconciliation.length],
            ["In sync", counts["in-sync"] ?? 0],
            ["Missing / stale", (counts.missing ?? 0) + (counts.stale ?? 0)],
            [
              "Invalid / orphaned",
              (counts["malformed-run"] ?? 0) +
                (counts["malformed-source"] ?? 0) +
                (counts.orphaned ?? 0),
            ],
          ].map(([term, value]) => (
            <div
              className="rounded-xl border border-white/10 bg-white/[0.035] p-3"
              key={term}
            >
              <dt className="text-xs text-white/45">{term}</dt>
              <dd className="font-score mt-1 text-xl font-black">{value}</dd>
            </div>
          ))}
        </dl>

        {message ? (
          <p
            className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm"
            role="status"
          >
            {message}
          </p>
        ) : null}
        {!championship.canMutate ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-[var(--color-warning-500)]">
            <AlertTriangle aria-hidden="true" size={17} /> Sync and bonus
            changes require an online organizer session.
          </p>
        ) : null}

        <ul className="mt-5 grid gap-3 lg:grid-cols-2">
          {championship.reconciliation.map((item) => (
            <SyncCard
              busy={!championship.canMutate || busy}
              item={item}
              key={item.competitionId}
              onReconcile={() =>
                void perform(
                  () => championship.reconcileOne(item),
                  `${item.competitionTitle} reconciled.`,
                )
              }
              onRemove={() => setConfirmOrphan(item)}
            />
          ))}
        </ul>
        {confirmOrphan ? (
          <div className="mt-4 rounded-2xl border border-[var(--color-warning-500)]/30 bg-[var(--color-warning-500)]/8 p-4">
            <p className="font-bold">
              Remove {confirmOrphan.competitionTitle}’s orphaned source?
            </p>
            <p className="mt-1 text-sm text-white/55">
              This removes current awards only after rechecking that no valid
              runtime exists. The audit record remains.
            </p>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => setConfirmOrphan(null)} variant="quiet">
                Cancel
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void perform(
                    () => championship.removeOrphan(confirmOrphan),
                    "Orphaned source removed.",
                  ).then(() => setConfirmOrphan(null))
                }
                variant="dark"
              >
                Confirm removal
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section
        aria-labelledby="manual-bonus-title"
        className="border-t border-white/10 pt-8"
      >
        <div className="flex items-center gap-3">
          <Award
            aria-hidden="true"
            className="text-[var(--color-antique-gold-400)]"
            size={22}
          />
          <div>
            <p className="text-xs text-white/45 uppercase">
              Positive awards only
            </p>
            <h2 className="text-xl font-extrabold" id="manual-bonus-title">
              Manual bonuses
            </h2>
          </div>
        </div>
        <form
          className="mt-5 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void perform(
              () =>
                championship.createBonus({
                  participantId,
                  points: Number(points),
                  label,
                  note,
                }),
              "Manual bonus awarded.",
            ).then(() => {
              setPoints("");
              setLabel("");
              setNote("");
            });
          }}
        >
          <label className="text-sm font-bold">
            Participant
            <select
              className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-[var(--color-night-900)] px-3"
              onChange={(event) => setParticipantId(event.target.value)}
              required
              value={participantId}
            >
              <option value="">Choose participant</option>
              {participants.organizerParticipants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.displayName}
                  {participant.status === "inactive" ? " · inactive" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            Points
            <input
              className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3"
              max="100"
              min="1"
              onChange={(event) => setPoints(event.target.value)}
              required
              type="number"
              value={points}
            />
          </label>
          <label className="text-sm font-bold sm:col-span-2">
            Reason
            <input
              className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3"
              maxLength={80}
              onChange={(event) => setLabel(event.target.value)}
              required
              value={label}
            />
          </label>
          <label className="text-sm font-bold sm:col-span-2">
            Optional note
            <textarea
              className="mt-2 min-h-24 w-full rounded-xl border border-white/15 bg-white/5 p-3"
              maxLength={280}
              onChange={(event) => setNote(event.target.value)}
              value={note}
            />
          </label>
          <div className="sm:col-span-2">
            <Button
              disabled={!championship.canMutate || busy}
              type="submit"
              variant="dark"
            >
              Award bonus
            </Button>
          </div>
        </form>

        <label className="mt-5 block max-w-sm text-sm font-bold">
          Filter bonus history
          <select
            className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-[var(--color-night-900)] px-3"
            onChange={(event) => setBonusFilter(event.target.value)}
            value={bonusFilter}
          >
            <option value="all">All participants</option>
            {participants.organizerParticipants.map((participant) => (
              <option key={participant.id} value={participant.id}>
                {participant.displayName}
              </option>
            ))}
          </select>
        </label>
        <ul className="mt-4 space-y-3">
          {filteredBonuses.map((bonus) => (
            <li
              className="rounded-xl border border-white/10 p-4"
              key={bonus.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">
                    {names.get(bonus.participantId) ??
                      "Unavailable participant"}{" "}
                    · +{bonus.points}
                  </p>
                  <p className="mt-1 text-sm text-white/55">
                    {bonus.label}
                    {bonus.note ? ` · ${bonus.note}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-white/35">
                    Revision {bonus.revision}
                  </p>
                </div>
                <StatusBadge
                  tone={bonus.status === "active" ? "live" : "neutral"}
                >
                  {bonus.status}
                </StatusBadge>
              </div>
              <Button
                className="mt-3"
                disabled={!championship.canMutate || busy}
                onClick={() => setConfirmBonus(bonus)}
                variant="quiet"
              >
                {bonus.status === "active" ? "Revoke…" : "Restore…"}
              </Button>
            </li>
          ))}
        </ul>
        {confirmBonus ? (
          <div className="mt-4 rounded-2xl border border-white/12 bg-white/5 p-4">
            <p className="font-bold">
              {confirmBonus.status === "active" ? "Revoke" : "Restore"} “
              {confirmBonus.label}”?
            </p>
            <p className="mt-1 text-sm text-white/55">
              The revision will advance and an audit event will be appended.
              Revoked awards stop counting but are not deleted.
            </p>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => setConfirmBonus(null)} variant="quiet">
                Cancel
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void perform(
                    () =>
                      confirmBonus.status === "active"
                        ? championship.revokeBonus(confirmBonus)
                        : championship.restoreBonus(confirmBonus),
                    `Bonus ${confirmBonus.status === "active" ? "revoked" : "restored"}.`,
                  ).then(() => setConfirmBonus(null))
                }
                variant="dark"
              >
                Confirm
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section
        aria-labelledby="ledger-inspection-title"
        className="border-t border-white/10 pt-8"
      >
        <div className="flex items-center gap-3">
          <ShieldCheck
            aria-hidden="true"
            className="text-[var(--color-electric-cyan-400)]"
            size={22}
          />
          <div>
            <p className="text-xs text-white/45 uppercase">
              Read-only source view
            </p>
            <h2 className="text-xl font-extrabold" id="ledger-inspection-title">
              Ledger inspection
            </h2>
          </div>
        </div>
        <p className="mt-2 text-sm text-white/50">
          Correct a competition result at its source; individual competition
          awards have no edit control.
        </p>
        <label className="mt-4 block max-w-sm text-sm font-bold">
          Competition
          <select
            className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-[var(--color-night-900)] px-3"
            onChange={(event) => setSourceFilter(event.target.value)}
            value={sourceFilter}
          >
            <option value="all">All sources</option>
            {championship.sources.map((source) => (
              <option
                key={source.meta.competitionId}
                value={source.meta.competitionId}
              >
                {source.meta.competitionTitle}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-4 space-y-3">
          {championship.sources
            .filter(
              (source) =>
                sourceFilter === "all" ||
                source.meta.competitionId === sourceFilter,
            )
            .map((source) => (
              <details
                className="rounded-xl border border-white/10 p-4"
                key={source.meta.competitionId}
              >
                <summary className="cursor-pointer font-bold focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--color-electric-cyan-400)]">
                  {source.meta.competitionTitle} · {source.meta.entryCount}{" "}
                  entries
                </summary>
                <dl className="mt-3 grid gap-2 text-xs text-white/50 sm:grid-cols-2">
                  <div>
                    <dt>Runtime revision</dt>
                    <dd className="font-score text-white">
                      {source.meta.runRevision}
                    </dd>
                  </div>
                  <div>
                    <dt>Fingerprint</dt>
                    <dd className="font-score break-all text-white">
                      {source.meta.sourceFingerprint}
                    </dd>
                  </div>
                </dl>
                <ul className="mt-3 divide-y divide-white/8">
                  {Object.values(source.entries).map((entry) => (
                    <li
                      className="grid grid-cols-[1fr_auto] gap-3 py-2 text-sm"
                      key={entry.id}
                    >
                      <span>
                        {names.get(entry.participantId) ??
                          "Unavailable participant"}{" "}
                        · {entry.label}
                      </span>
                      <strong className="font-score text-[var(--color-electric-cyan-400)]">
                        +{entry.points}
                      </strong>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
        </div>
        {championship.malformedSourceIds.length ||
        championship.malformedBonusIds.length ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-[var(--color-warning-500)]">
            <AlertTriangle aria-hidden="true" size={17} /> Quarantined records:{" "}
            {championship.malformedSourceIds.length} sources and{" "}
            {championship.malformedBonusIds.length} bonuses.
          </p>
        ) : (
          <p className="mt-4 flex items-center gap-2 text-sm text-[var(--color-electric-cyan-400)]">
            <CheckCircle2 aria-hidden="true" size={17} /> All loaded ledger
            records passed client validation.
          </p>
        )}
      </section>
    </div>
  );
}
