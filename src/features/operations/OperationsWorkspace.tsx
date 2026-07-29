import { useEffect, useState } from "react";
import {
  ClipboardCheck,
  ClipboardCopy,
  ExternalLink,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/StatusBadge";
import type { AppCheckDiagnostics } from "../../lib/firebase/appCheck";
import { useAuth } from "../auth/AuthProvider";
import { useBirthdayVault } from "../birthday-vault/BirthdayVaultProvider";
import { useChampionship } from "../championship/ChampionshipProvider";
import { useCompetitions } from "../competitions/CompetitionsProvider";
import { useConnection } from "../live/ConnectionProvider";
import { useFirebase } from "../live/FirebaseProvider";
import { useParticipants } from "../participants/ParticipantsProvider";
import { useSpecialReveal } from "../special-reveal/SpecialRevealProvider";
import { useVersion } from "./VersionProvider";
import { RECENT_AUTH_MAX_AGE_MS } from "../auth/recentAuthorization";

type DiagnosticTone = "live" | "gold" | "neutral";
type PreflightStatus = "Passed" | "Warning" | "Blocked";
type OrganizerWorkspace =
  "competitions" | "championship" | "birthday" | "special-reveal";

function tone(value: string): DiagnosticTone {
  if (
    value === "ready" ||
    value === "online" ||
    value === "current" ||
    value === "Passed"
  )
    return "live";
  if (
    value === "error" ||
    value === "offline" ||
    value === "invalid" ||
    value === "Warning" ||
    value === "Blocked"
  )
    return "gold";
  return "neutral";
}

function databaseHostname(databaseUrl: string) {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return "unavailable";
  }
}

function DiagnosticRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3">
      <div>
        <dt className="text-sm font-bold text-white">{label}</dt>
        {detail ? (
          <dd className="mt-1 text-xs text-white/45">{detail}</dd>
        ) : null}
      </div>
      <StatusBadge tone={tone(value)}>{value}</StatusBadge>
    </div>
  );
}

function PreflightRow({
  label,
  status,
  detail,
}: {
  label: string;
  status: PreflightStatus;
  detail: string;
}) {
  return (
    <li className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-bold text-white">{label}</span>
        <StatusBadge tone={tone(status)}>{status}</StatusBadge>
      </div>
      <p className="mt-1 text-xs leading-5 text-white/45">{detail}</p>
    </li>
  );
}

export function OperationsWorkspace({
  onOpenWorkspace,
}: {
  onOpenWorkspace?: (workspace: OrganizerWorkspace) => void;
}) {
  const firebase = useFirebase();
  const auth = useAuth();
  const connection = useConnection();
  const participants = useParticipants();
  const competitions = useCompetitions();
  const birthday = useBirthdayVault();
  const specialReveal = useSpecialReveal();
  const championship = useChampionship();
  const version = useVersion();
  const [appCheck, setAppCheck] = useState<AppCheckDiagnostics | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const [diagnosticTime, setDiagnosticTime] = useState(() => Date.now());
  const [browserOnline, setBrowserOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    if (firebase.status !== "ready") return;
    let active = true;
    void firebase.clients.appCheckReady.then((result) => {
      if (active) setAppCheck(result);
    });
    return () => {
      active = false;
    };
  }, [firebase]);

  useEffect(() => {
    const online = () => setBrowserOnline(true);
    const offline = () => setBrowserOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  const organizerAuthAgeMs =
    auth.organizer.status === "authorized"
      ? Math.max(0, diagnosticTime - auth.organizer.authTimeMs)
      : null;
  const recentAuthStatus =
    organizerAuthAgeMs !== null && organizerAuthAgeMs <= RECENT_AUTH_MAX_AGE_MS
      ? "current"
      : "expired";
  const malformedRecordCount =
    competitions.publicMalformedCount +
    competitions.organizerMalformedCount +
    competitions.runtimeMalformedCount +
    birthday.malformedIds.length +
    specialReveal.malformedIds.length +
    championship.malformedSourceIds.length +
    championship.malformedBonusIds.length;

  const diagnostics = {
    generatedAt: new Date(diagnosticTime).toISOString(),
    build: version.current,
    deployedBuild: version.deployed,
    versionStatus: version.status,
    firebase:
      firebase.status === "ready"
        ? {
            status: "ready",
            projectId: firebase.config.options.projectId,
            databaseHostname: databaseHostname(
              firebase.config.options.databaseURL,
            ),
            emulators: firebase.clients.useEmulators,
          }
        : { status: firebase.status },
    connection,
    authentication: {
      guest: auth.guest.status,
      organizer: auth.organizer.status,
      adminClaim: auth.organizer.status === "authorized",
      specialRevealClaim:
        auth.organizer.status === "authorized" &&
        auth.organizer.specialRevealAdmin,
      organizerSession: auth.organizerSession.status,
      organizerSessionRemainingMs: auth.organizerSession.remainingMs,
      organizerAuthAgeMs,
      recentAuth: recentAuthStatus,
    },
    appCheck,
    featureSync: {
      participants: participants.activeState,
      organizerParticipants: participants.organizerState,
      competitions: competitions.publicState,
      organizerCompetitions: competitions.organizerState,
      birthdayVault: birthday.state,
      organizerBirthdayVault: birthday.organizerState,
      specialReveal: specialReveal.state,
      organizerSpecialReveal: specialReveal.organizerState,
      championship: championship.state,
      championshipReconciliationItems: championship.reconciliation.length,
      activeCompetitions: competitions.active.length,
      browserOnline,
    },
    quarantinedRecords: {
      total: malformedRecordCount,
      competitions:
        competitions.publicMalformedCount +
        competitions.organizerMalformedCount +
        competitions.runtimeMalformedCount,
      birthdayVault: birthday.malformedIds.length,
      specialReveal: specialReveal.malformedIds.length,
      championship:
        championship.malformedSourceIds.length +
        championship.malformedBonusIds.length,
    },
  };

  async function copyDiagnostics() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2_000);
    } catch {
      setCopyState("error");
    }
  }

  async function refreshDiagnostics() {
    setDiagnosticTime(Date.now());
    if (firebase.status === "ready")
      setAppCheck(await firebase.clients.appCheckReady);
    await version.check();
  }

  const appCheckStatus =
    appCheck?.guest.status === "ready" && appCheck.organizer.status === "ready"
      ? "ready"
      : (appCheck?.guest.status ?? "checking");
  const deployedUrl = `${window.location.origin}${import.meta.env.BASE_URL}`;
  const appCheckInvalid =
    appCheck?.guest.status === "invalid" ||
    appCheck?.organizer.status === "invalid";
  const appCheckTokenAvailable =
    appCheck?.guest.tokenAvailable === true &&
    appCheck.organizer.tokenAvailable === true;
  const preflight: Array<{
    label: string;
    status: PreflightStatus;
    detail: string;
  }> = [
    {
      label: "Current build SHA known",
      status: version.current.sha === "local" ? "Warning" : "Passed",
      detail:
        version.current.sha === "local"
          ? "Local fallback metadata is active."
          : version.current.sha.slice(0, 12),
    },
    {
      label: "Firebase configured",
      status: firebase.status === "ready" ? "Passed" : "Blocked",
      detail:
        firebase.status === "ready"
          ? `${firebase.config.options.projectId} · ${databaseHostname(firebase.config.options.databaseURL)}`
          : "Firebase configuration is unavailable.",
    },
    {
      label: "Realtime connection live",
      status: connection === "online" ? "Passed" : "Blocked",
      detail: `Realtime Database reports ${connection}.`,
    },
    {
      label: "Organizer authorized",
      status: auth.organizer.status === "authorized" ? "Passed" : "Blocked",
      detail: "The server-issued admin claim is required.",
    },
    {
      label: "Reveal-admin claim",
      status:
        auth.organizer.status === "authorized" &&
        auth.organizer.specialRevealAdmin
          ? "Passed"
          : "Warning",
      detail: "Required only for the protected Special Reveal workspace.",
    },
    {
      label: "Organizer session",
      status:
        auth.organizerSession.status === "active"
          ? "Passed"
          : auth.organizerSession.status === "warning"
            ? "Warning"
            : "Blocked",
      detail: `${Math.ceil(auth.organizerSession.remainingMs / 60_000)} minute(s) remain before idle sign-out.`,
    },
    {
      label: "Recent authorization",
      status: recentAuthStatus === "current" ? "Passed" : "Warning",
      detail:
        recentAuthStatus === "current"
          ? "A sensitive action may reuse the current five-minute authorization window."
          : "Sensitive actions will require password reauthentication.",
    },
    {
      label: "App Check client",
      status: appCheckInvalid
        ? "Blocked"
        : appCheckTokenAvailable
          ? "Passed"
          : "Warning",
      detail:
        appCheck?.provider === "disabled"
          ? "Client attestation is staged off; enforcement remains a manual Console decision."
          : appCheckTokenAvailable
            ? "Guest and organizer tokens are available; enforcement status remains unknown."
            : "Initialization or token availability is incomplete; enforcement status remains unknown.",
    },
    {
      label: "Championship synchronized",
      status:
        championship.state === "ready" &&
        championship.reconciliation.length === 0 &&
        championship.malformedSourceIds.length === 0
          ? "Passed"
          : championship.state === "error" ||
              championship.malformedSourceIds.length > 0
            ? "Blocked"
            : "Warning",
      detail: `${championship.reconciliation.length} reconciliation item(s) need review.`,
    },
    {
      label: "Birthday Vault state valid",
      status:
        birthday.organizerState === "ready" &&
        birthday.malformedIds.length === 0
          ? "Passed"
          : birthday.organizerState === "error" || birthday.malformedIds.length
            ? "Blocked"
            : "Warning",
      detail: `${birthday.malformedIds.length} malformed private record(s).`,
    },
    {
      label: "Special Reveal state valid",
      status:
        specialReveal.organizerState === "ready" &&
        specialReveal.malformedIds.length === 0
          ? "Passed"
          : specialReveal.organizerState === "error" ||
              specialReveal.malformedIds.length
            ? "Blocked"
            : "Warning",
      detail: `${specialReveal.malformedIds.length} malformed protected record(s).`,
    },
    {
      label: "Runtime data integrity",
      status: malformedRecordCount === 0 ? "Passed" : "Blocked",
      detail: `${malformedRecordCount} malformed record(s) are quarantined across live features.`,
    },
    {
      label: "Browser online",
      status: browserOnline ? "Passed" : "Blocked",
      detail: browserOnline
        ? "The browser reports network connectivity."
        : "The browser reports that it is offline.",
    },
    {
      label: "Deployed version current",
      status:
        version.status === "current"
          ? "Passed"
          : version.status === "update-available"
            ? "Blocked"
            : "Warning",
      detail:
        version.status === "update-available"
          ? "A newer deployed build is available; refresh when safe."
          : `Version check status: ${version.status}.`,
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <StatusBadge tone="live">Read-only</StatusBadge>
          <h3 className="font-display mt-3 text-3xl font-semibold">
            Operations
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            Sanitized runtime health for rehearsals and incident triage. This
            workspace cannot alter Firebase configuration, Rules, or event data.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void refreshDiagnostics()} variant="quiet">
            <RefreshCw aria-hidden="true" size={16} /> Refresh diagnostics
          </Button>
          <Button onClick={() => void copyDiagnostics()} variant="quiet">
            {copyState === "copied" ? (
              <ClipboardCheck aria-hidden="true" size={16} />
            ) : (
              <ClipboardCopy aria-hidden="true" size={16} />
            )}
            {copyState === "copied" ? "Copied" : "Copy diagnostics"}
          </Button>
          <p aria-live="polite" className="sr-only">
            {copyState === "copied"
              ? "Sanitized diagnostics copied."
              : copyState === "error"
                ? "Diagnostics could not be copied."
                : ""}
          </p>
        </div>
      </div>

      <section aria-labelledby="operations-preflight" className="mt-7">
        <h4
          className="flex items-center gap-2 font-bold"
          id="operations-preflight"
        >
          <ShieldCheck aria-hidden="true" size={18} /> Preflight
        </h4>
        <p className="mt-2 max-w-2xl text-xs leading-5 text-white/45">
          This is a readiness aid, not a security guarantee. Resolve blocked
          items and review warnings before the event.
        </p>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {preflight.map((item) => (
            <PreflightRow key={item.label} {...item} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="operations-sync" className="mt-7">
        <h4 className="font-bold" id="operations-sync">
          Feature synchronization
        </h4>
        <dl className="mt-4 grid gap-3 md:grid-cols-2">
          <DiagnosticRow
            label="Participants"
            value={participants.organizerState}
          />
          <DiagnosticRow
            label="Competitions"
            value={competitions.organizerState}
          />
          <DiagnosticRow
            label="Birthday Vault"
            value={birthday.organizerState}
          />
          <DiagnosticRow
            label="Special Reveal"
            value={specialReveal.organizerState}
          />
          <DiagnosticRow label="Championship" value={championship.state} />
          <DiagnosticRow
            detail={`${competitions.active.length} live competition(s)`}
            label="Active competitions"
            value={competitions.organizerState}
          />
          <DiagnosticRow
            detail="Enforcement cannot be inferred from browser code"
            label="App Check enforcement"
            value={appCheck?.enforcement ?? "unknown"}
          />
        </dl>
      </section>

      <section
        aria-labelledby="operations-build"
        className="mt-7 rounded-2xl border border-white/10 bg-white/[0.025] p-5"
      >
        <h4 className="font-bold" id="operations-build">
          Build and environment
        </h4>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-white/45">Commit</dt>
            <dd className="mt-1 font-mono text-white/75">
              {version.current.sha.slice(0, 12)}
            </dd>
          </div>
          <div>
            <dt className="text-white/45">Ref</dt>
            <dd className="mt-1 break-all font-mono text-white/75">
              {version.current.ref}
            </dd>
          </div>
          <div>
            <dt className="text-white/45">Built</dt>
            <dd className="mt-1 text-white/75">{version.current.builtAt}</dd>
          </div>
          <div>
            <dt className="text-white/45">Firebase project</dt>
            <dd className="mt-1 font-mono text-white/75">
              {firebase.status === "ready"
                ? firebase.config.options.projectId
                : "unavailable"}
            </dd>
          </div>
          <div>
            <dt className="text-white/45">Database hostname</dt>
            <dd className="mt-1 font-mono text-white/75">
              {firebase.status === "ready"
                ? databaseHostname(firebase.config.options.databaseURL)
                : "unavailable"}
            </dd>
          </div>
          <div>
            <dt className="text-white/45">Organizer auth age</dt>
            <dd className="mt-1 text-white/75">
              {organizerAuthAgeMs === null
                ? "unavailable"
                : `${Math.floor(organizerAuthAgeMs / 60_000)} minute(s)`}
            </dd>
          </div>
          <div>
            <dt className="text-white/45">Recent authorization</dt>
            <dd className="mt-1 text-white/75">{recentAuthStatus}</dd>
          </div>
          <div>
            <dt className="text-white/45">App Check tokens</dt>
            <dd className="mt-1 text-white/75">
              {appCheckTokenAvailable ? "available" : appCheckStatus}
            </dd>
          </div>
        </dl>
      </section>

      {onOpenWorkspace ? (
        <section aria-labelledby="operations-workspaces" className="mt-7">
          <h4 className="font-bold" id="operations-workspaces">
            Continue preflight
          </h4>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => onOpenWorkspace("competitions")}
              variant="quiet"
            >
              Competition Studio
            </Button>
            <Button
              onClick={() => onOpenWorkspace("championship")}
              variant="quiet"
            >
              Championship Desk
            </Button>
            <Button onClick={() => onOpenWorkspace("birthday")} variant="quiet">
              Birthday Vault
            </Button>
            {auth.organizer.status === "authorized" &&
            auth.organizer.specialRevealAdmin ? (
              <Button
                onClick={() => onOpenWorkspace("special-reveal")}
                variant="quiet"
              >
                Special Reveal
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="mt-7 flex flex-wrap gap-3 border-t border-white/10 pt-5">
        <a
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/12 px-4 text-sm font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--color-electric-cyan-400)]"
          href={deployedUrl}
          rel="noreferrer"
          target="_blank"
        >
          <ExternalLink aria-hidden="true" size={16} /> Open deployed app
        </a>
        <Button onClick={() => void auth.signOutOrganizer()} variant="quiet">
          <LogOut aria-hidden="true" size={16} /> Sign out Organizer Mode
        </Button>
      </div>
    </div>
  );
}
