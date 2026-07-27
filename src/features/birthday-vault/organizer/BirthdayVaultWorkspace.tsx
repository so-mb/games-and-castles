import { lazy, Suspense, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  MailOpen,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { useBirthdayVault } from "../BirthdayVaultProvider";
import { birthdayEmojiSymbol } from "../domain/emoji";
import { createPublishedBirthdaySnapshot } from "../domain/publication";
import type {
  BirthdayModerationItem,
  PublishedBirthdayMessage,
} from "../domain/types";
import { useParticipants } from "../../participants/ParticipantsProvider";

const BirthdayVaultPresentation = lazy(() =>
  import("../presentation/BirthdayVaultPresentation").then((module) => ({
    default: module.BirthdayVaultPresentation,
  })),
);

type Filter = "pending" | "approved" | "hidden" | "withdrawn" | "stale" | "all";

const dummyPreview: PublishedBirthdayMessage[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Rehearsal card",
    message:
      "This is synthetic rehearsal copy. No private message or future reveal content is used.",
    emojiKey: "sparkles",
    author: {
      mode: "anonymous",
      participantId: null,
      displayName: "Anonymous",
      avatarIcon: null,
      avatarTone: null,
    },
    displayOrder: 0,
    sourceMessageRevision: 1,
    publishedAt: 0,
    revealRevision: 1,
    schemaVersion: 1,
  },
];

function itemFilter(item: BirthdayModerationItem, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "withdrawn") return item.message.status === "withdrawn";
  if (filter === "stale")
    return (
      item.message.status === "submitted" &&
      Boolean(item.moderation) &&
      !item.moderationIsCurrent
    );
  if (item.message.status !== "submitted") return false;
  if (filter === "pending") return item.moderation === null;
  return item.moderationIsCurrent && item.moderation?.status === filter;
}

function ModerationCard({
  item,
  index,
  total,
}: {
  item: BirthdayModerationItem;
  index: number;
  total: number;
}) {
  const vault = useBirthdayVault();
  const [note, setNote] = useState(item.moderation?.note ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state =
    item.message.status === "withdrawn"
      ? "Withdrawn"
      : item.moderation && !item.moderationIsCurrent
        ? "Needs review · prior decision stale"
        : item.moderation?.status === "approved"
          ? "Approved"
          : item.moderation?.status === "hidden"
            ? "Hidden"
            : "Pending review";

  async function act(action: "approved" | "hidden" | "earlier" | "later") {
    setPending(true);
    setError(null);
    try {
      if (action === "earlier" || action === "later") {
        await vault.move(item, action === "earlier" ? -1 : 1);
      } else {
        await vault.moderate(item, action, note);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The moderation change could not be saved.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-white">{item.participantName}</p>
          <p className="mt-1 text-xs text-white/48">
            {item.message.displayMode === "anonymous"
              ? "Publicly anonymous"
              : "Publicly named"}{" "}
            · message revision {item.message.revision}
          </p>
        </div>
        <StatusBadge
          tone={
            state === "Approved"
              ? "live"
              : state === "Hidden"
                ? "neutral"
                : "gold"
          }
        >
          {state}
        </StatusBadge>
      </div>
      <div className="mt-4 rounded-xl border border-white/8 bg-black/15 p-4">
        <p
          aria-hidden="true"
          className="text-xl text-[var(--color-antique-gold-400)]"
        >
          {birthdayEmojiSymbol(item.message.emojiKey) ?? "✦"}
        </p>
        {item.message.title ? (
          <h4 className="mt-2 font-bold text-white">{item.message.title}</h4>
        ) : null}
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/72">
          {item.message.message}
        </p>
      </div>
      {item.moderation && !item.moderationIsCurrent ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--color-antique-gold-400)]/8 p-3 text-xs leading-5 text-[var(--color-antique-gold-400)]">
          <ShieldAlert
            aria-hidden="true"
            className="mt-0.5 shrink-0"
            size={15}
          />
          The guest edited this message after moderation. Review and approve the
          current revision again.
        </p>
      ) : null}
      <label className="mt-4 block text-xs font-bold tracking-wide text-white/60 uppercase">
        Private moderation note
        <textarea
          className="mt-2 min-h-20 w-full rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm font-normal tracking-normal text-white normal-case outline-none focus:border-[var(--color-electric-cyan-400)] focus:ring-3 focus:ring-[var(--color-electric-cyan-400)]/15"
          disabled={pending || !vault.canOrganizerMutate}
          maxLength={281}
          onChange={(event) => setNote(event.target.value)}
          value={note}
        />
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          disabled={
            pending ||
            !vault.canOrganizerMutate ||
            item.message.status === "withdrawn"
          }
          onClick={() => void act("approved")}
          variant="dark"
        >
          <Check aria-hidden="true" size={16} /> Approve current
        </Button>
        <Button
          className="border border-white/12 text-white"
          disabled={
            pending ||
            !vault.canOrganizerMutate ||
            item.message.status === "withdrawn"
          }
          onClick={() => void act("hidden")}
          variant="quiet"
        >
          <EyeOff aria-hidden="true" size={16} /> Hide
        </Button>
        {item.moderationIsCurrent && item.moderation?.status === "approved" ? (
          <>
            <Button
              aria-label={`Move ${item.participantName} earlier`}
              className="border border-white/12 text-white"
              disabled={pending || !vault.canOrganizerMutate || index === 0}
              onClick={() => void act("earlier")}
              variant="quiet"
            >
              <ArrowUp aria-hidden="true" size={16} /> Earlier
            </Button>
            <Button
              aria-label={`Move ${item.participantName} later`}
              className="border border-white/12 text-white"
              disabled={
                pending || !vault.canOrganizerMutate || index === total - 1
              }
              onClick={() => void act("later")}
              variant="quiet"
            >
              <ArrowDown aria-hidden="true" size={16} /> Later
            </Button>
          </>
        ) : null}
      </div>
      {error ? (
        <p className="mt-3 text-sm text-[#ffc3c6]" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export function BirthdayVaultWorkspace() {
  const vault = useBirthdayVault();
  const participants = useParticipants();
  const [filter, setFilter] = useState<Filter>("all");
  const [preview, setPreview] = useState<PublishedBirthdayMessage[] | null>(
    null,
  );
  const [confirming, setConfirming] = useState<"reveal" | "republish" | null>(
    null,
  );
  const [confirmation, setConfirmation] = useState("");
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filtered = vault.organizerItems.filter((item) =>
    itemFilter(item, filter),
  );
  const approvedOrder = vault.readiness.approvedMessages;
  const approvedIndexes = new Map(
    approvedOrder.map((item, index) => [item.message.ownerUid, index]),
  );
  const previewMessages = useMemo(() => {
    if (approvedOrder.length === 0) return dummyPreview;
    return Object.values(
      createPublishedBirthdaySnapshot({
        items: vault.organizerItems,
        participants: participants.organizerParticipants,
        publishedAt: vault.publicState?.updatedAt ?? 0,
        revealRevision: Math.max(
          1,
          (vault.publicState?.revealRevision ?? 0) + 1,
        ),
      }),
    ).sort((left, right) => left.displayOrder - right.displayOrder);
  }, [
    approvedOrder.length,
    participants.organizerParticipants,
    vault.organizerItems,
    vault.publicState?.revealRevision,
    vault.publicState?.updatedAt,
  ]);

  async function action(operation: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await operation();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The Birthday Vault operation failed.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <StatusBadge
            tone={vault.publicState?.status === "revealed" ? "live" : "gold"}
          >
            {vault.publicState?.status ?? "Unopened"}
          </StatusBadge>
          <h3 className="font-display mt-3 text-3xl font-semibold">
            Birthday Vault
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            Moderate private submissions, rehearse the exact approved set, and
            publish one sanitized snapshot. Message text never enters audit
            records.
          </p>
        </div>
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50">
          State revision {vault.publicState?.revision ?? 0} · reveal revision{" "}
          {vault.publicState?.revealRevision ?? 0}
        </p>
      </div>

      <dl className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(
          [
            ["Submitted", vault.counts.submitted],
            ["Pending", vault.counts.pending],
            ["Approved", vault.counts.approved],
            ["Hidden", vault.counts.hidden],
            ["Withdrawn", vault.counts.withdrawn],
            ["Stale", vault.counts.stale],
          ] as const
        ).map(([label, count]) => (
          <div
            className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
            key={label}
          >
            <dt className="text-xs text-white/45">{label}</dt>
            <dd className="font-score mt-1 text-2xl font-extrabold">{count}</dd>
          </div>
        ))}
      </dl>

      <section
        aria-labelledby="vault-state-controls"
        className="mt-7 rounded-2xl border border-white/10 bg-white/[0.025] p-5"
      >
        <h4 className="font-bold" id="vault-state-controls">
          State controls
        </h4>
        <div className="mt-4 flex flex-wrap gap-2">
          {!vault.publicState ? (
            <Button
              disabled={pending || !vault.canOrganizerMutate}
              onClick={() => void action(vault.initialize)}
              variant="dark"
            >
              <MailOpen aria-hidden="true" size={17} /> Open submissions
            </Button>
          ) : vault.publicState.status === "collecting" ? (
            <Button
              disabled={pending || !vault.canOrganizerMutate}
              onClick={() => void action(vault.close)}
              variant="dark"
            >
              <LockKeyhole aria-hidden="true" size={17} /> Close submissions
            </Button>
          ) : vault.publicState.status === "closed" ? (
            <Button
              className="border border-white/12 text-white"
              disabled={pending || !vault.canOrganizerMutate}
              onClick={() => void action(vault.reopen)}
              variant="quiet"
            >
              <RotateCcw aria-hidden="true" size={17} /> Reopen submissions
            </Button>
          ) : null}
          <Button
            className="border border-white/12 text-white"
            disabled={pending || vault.organizerState !== "ready"}
            onClick={() => setPreview(previewMessages)}
            variant="quiet"
          >
            <Eye aria-hidden="true" size={17} />{" "}
            {approvedOrder.length ? "Private preview" : "Dummy rehearsal"}
          </Button>
          {vault.publicState?.status === "closed" ? (
            <Button
              disabled={
                pending || !vault.readiness.ready || !vault.canOrganizerMutate
              }
              onClick={() => {
                setConfirmation("");
                setConfirming("reveal");
              }}
              variant="dark"
            >
              Reveal approved messages
            </Button>
          ) : vault.publicState?.status === "revealed" ? (
            <Button
              disabled={
                pending || !vault.readiness.ready || !vault.canOrganizerMutate
              }
              onClick={() => {
                setConfirmation("");
                setConfirming("republish");
              }}
              variant="dark"
            >
              Republish approved set
            </Button>
          ) : null}
        </div>
        {error ? (
          <p
            className="mt-4 rounded-xl border border-[#ff9ca1]/25 bg-[#ff9ca1]/8 p-3 text-sm text-[#ffc3c6]"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </section>

      <section
        aria-labelledby="vault-readiness"
        className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="font-bold" id="vault-readiness">
            Reveal readiness
          </h4>
          <StatusBadge tone={vault.readiness.ready ? "live" : "gold"}>
            {vault.readiness.ready ? "Ready" : "Blocked"}
          </StatusBadge>
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {vault.readiness.checks.map((check) => (
            <li
              className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${check.passed ? "bg-[var(--color-electric-cyan-400)]/7 text-white/70" : "bg-[var(--color-antique-gold-400)]/8 text-[var(--color-antique-gold-400)]"}`}
              key={check.id}
            >
              {check.passed ? (
                <Check
                  aria-hidden="true"
                  className="mt-0.5 shrink-0"
                  size={15}
                />
              ) : (
                <ShieldAlert
                  aria-hidden="true"
                  className="mt-0.5 shrink-0"
                  size={15}
                />
              )}
              {check.label}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="vault-moderation" className="mt-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h4 className="font-bold" id="vault-moderation">
              Private moderation
            </h4>
            <p className="mt-1 text-sm text-white/48">
              Visible only to authorized organizers.
            </p>
          </div>
          {vault.counts.pending > 0 ? (
            bulkConfirm ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-antique-gold-400)]/25 p-2">
                <span className="px-2 text-xs text-white/60">
                  Approve {vault.counts.pending} current pending messages?
                </span>
                <Button
                  disabled={pending}
                  onClick={() =>
                    void action(async () => {
                      await vault.bulkApprove();
                      setBulkConfirm(false);
                    })
                  }
                  variant="dark"
                >
                  Confirm
                </Button>
                <Button
                  className="text-white"
                  onClick={() => setBulkConfirm(false)}
                  variant="quiet"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                className="border border-white/12 text-white"
                disabled={pending || !vault.canOrganizerMutate}
                onClick={() => setBulkConfirm(true)}
                variant="quiet"
              >
                Approve all current pending
              </Button>
            )
          ) : null}
        </div>
        <div
          aria-label="Filter Birthday Vault messages"
          className="mt-4 flex flex-wrap gap-2"
          role="group"
        >
          {(
            [
              "all",
              "pending",
              "approved",
              "hidden",
              "withdrawn",
              "stale",
            ] as Filter[]
          ).map((option) => (
            <button
              aria-pressed={filter === option}
              className="min-h-11 rounded-xl border border-white/10 px-3 text-xs font-bold text-white/55 capitalize aria-pressed:border-[var(--color-electric-cyan-400)] aria-pressed:bg-[var(--color-electric-cyan-400)]/10 aria-pressed:text-[var(--color-electric-cyan-400)]"
              key={option}
              onClick={() => setFilter(option)}
              type="button"
            >
              {option === "stale" ? "Stale approval" : option}
            </button>
          ))}
        </div>
        {vault.organizerState === "loading" ? (
          <p className="py-10 text-center text-sm text-white/55" role="status">
            Loading private messages…
          </p>
        ) : filtered.length === 0 ? (
          <p className="mt-5 rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-white/55">
            No messages match this filter.
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {filtered.map((item) => (
              <ModerationCard
                index={approvedIndexes.get(item.message.ownerUid) ?? -1}
                item={item}
                key={item.message.ownerUid}
                total={approvedOrder.length}
              />
            ))}
          </ul>
        )}
        {vault.malformedIds.length > 0 ? (
          <p
            className="mt-4 rounded-xl bg-[#ff9ca1]/8 p-3 text-sm text-[#ffc3c6]"
            role="alert"
          >
            {vault.malformedIds.length} Birthday Vault record(s) were
            quarantined. Publication remains blocked until they are corrected.
          </p>
        ) : null}
      </section>

      <Modal
        description={`${vault.counts.approved} current approved messages will become immediately visible to connected guests. This phrase prevents an accidental click; it is not authentication.`}
        onClose={() => setConfirming(null)}
        open={confirming !== null}
        title={
          confirming === "republish"
            ? "Republish Birthday Vault"
            : "Open Birthday Vault for everyone"
        }
      >
        <label className="block text-sm font-bold">
          Type REVEAL to{" "}
          {confirming === "republish"
            ? "replace the published set"
            : "open the Birthday Vault for everyone"}
          .
          <input
            autoComplete="off"
            className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-white/7 px-4 text-base outline-none focus:border-[var(--color-electric-cyan-400)] focus:ring-3 focus:ring-[var(--color-electric-cyan-400)]/18"
            onChange={(event) => setConfirmation(event.target.value)}
            value={confirmation}
          />
        </label>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            disabled={
              confirmation !== "REVEAL" || pending || !vault.canOrganizerMutate
            }
            onClick={() =>
              void action(async () => {
                await vault.publish(confirming === "republish");
                setConfirming(null);
                setConfirmation("");
              })
            }
            variant="dark"
          >
            Confirm {confirming === "republish" ? "republish" : "reveal"}
          </Button>
          <Button
            className="text-white"
            onClick={() => setConfirming(null)}
            variant="quiet"
          >
            Cancel
          </Button>
        </div>
      </Modal>

      {preview ? (
        <Suspense
          fallback={
            <p className="sr-only" role="status">
              Opening private preview…
            </p>
          }
        >
          <BirthdayVaultPresentation
            label={
              approvedOrder.length
                ? "Private preview"
                : "Private preview · dummy rehearsal"
            }
            messages={preview}
            onClose={() => setPreview(null)}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
