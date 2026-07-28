import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import {
  buildCorrectRevealMutation,
  buildOpenRevealMutation,
  buildPredictionStateMutation,
  buildReconcilePredictionMutation,
  buildResolveRevealMutation,
} from "../src/features/special-reveal/domain/operations.ts";
import { buildPredictionResolution } from "../src/features/special-reveal/domain/resolution.ts";
import {
  parsePrediction,
  parsePredictionLedgerSources,
  parseSpecialRevealPrivateConfig,
  parseSpecialRevealPublicResolution,
  parseSpecialRevealPublicState,
} from "../src/features/special-reveal/domain/validation.ts";

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function usage(message) {
  if (message) console.error(message);
  console.error(
    "Usage: npm run reveal:admin-local -- --project PROJECT_ID [--dry-run] [--emulator]",
  );
  process.exit(1);
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function predictions(value) {
  return Object.values(object(value))
    .map(parsePrediction)
    .filter((prediction) => prediction !== null);
}

function required(value, message) {
  if (!value) throw new Error(message);
  return value;
}

function auditKey(database) {
  const key = database.ref("audit").push().key;
  if (!key) throw new Error("Firebase could not allocate an audit ID.");
  return key;
}

function addFallbackAudit(database, mutation, action, eventId, now) {
  if (!mutation.updates) return mutation;
  const id = auditKey(database);
  return {
    ...mutation,
    updates: {
      ...mutation.updates,
      [`audit/${id}`]: {
        id,
        action: "special-reveal-local-fallback",
        entityType: "special-reveal",
        entityId: eventId,
        actorUid: "trusted-local-admin",
        occurredAt: now,
        summary: `Trusted local fallback completed: ${action}.`,
        schemaVersion: 1,
      },
    },
  };
}

async function chooseOption(prompt) {
  const answer = (await prompt.question("Choose the correct option (a/b): "))
    .trim()
    .toLowerCase();
  if (answer === "a") return "option-a";
  if (answer === "b") return "option-b";
  throw new Error("Choose only a or b.");
}

async function load(database) {
  const root = object((await database.ref().get()).val());
  const reveal = object(root.specialReveal);
  const config = parseSpecialRevealPrivateConfig(reveal.privateConfig);
  const state = parseSpecialRevealPublicState(reveal.publicState);
  const resolution = parseSpecialRevealPublicResolution(
    reveal.publicResolution,
  );
  const sourceResult = parsePredictionLedgerSources(
    config
      ? {
          [config.eventId]: object(
            object(root.championshipLedger).predictionSources,
          )[config.eventId],
        }
      : null,
  );
  return {
    config,
    state,
    resolution,
    predictions: predictions(reveal.predictions),
    participants: object(root.participants),
    profiles: object(root.userProfiles),
    currentSource: sourceResult.sources[0] ?? null,
  };
}

function printState(data, dryRun) {
  console.log(`Mode: ${dryRun ? "DRY RUN" : "MUTATING"}`);
  console.log(`Lifecycle: ${data.state?.status ?? "locked"}`);
  console.log(`State revision: ${data.state?.revision ?? 0}`);
  console.log(`Resolution revision: ${data.state?.resolutionRevision ?? 0}`);
  console.log(`Configuration present: ${data.config ? "yes" : "no"}`);
  console.log(`Stored prediction records: ${data.predictions.length}`);
  console.log(
    `Prediction source present: ${data.currentSource ? "yes" : "no"}`,
  );
}

async function confirm(prompt, projectId, action, dryRun) {
  console.log(`Target project: ${projectId}`);
  console.log(`Action: ${action}${dryRun ? " (dry run; no write)" : ""}`);
  const answer = await prompt.question(
    `Type ${dryRun ? "PREVIEW" : "APPLY"} to continue: `,
  );
  return answer.trim() === (dryRun ? "PREVIEW" : "APPLY");
}

const projectId = argument("project");
const dryRun = hasFlag("dry-run");
const emulator = hasFlag("emulator");

if (!projectId) usage("Provide the exact target project with --project.");
if (!emulator && projectId.startsWith("demo-"))
  usage("Demo project IDs require --emulator.");
if (!emulator && !process.env.GOOGLE_APPLICATION_CREDENTIALS)
  usage("Set GOOGLE_APPLICATION_CREDENTIALS outside the repository first.");

if (emulator) process.env.FIREBASE_DATABASE_EMULATOR_HOST = "127.0.0.1:9000";
if (getApps().length === 0) {
  initializeApp(
    emulator
      ? {
          projectId,
          databaseURL: `http://127.0.0.1:9000?ns=${projectId}`,
        }
      : { credential: applicationDefault(), projectId },
  );
}

const database = getDatabase();
const prompt = createInterface({ input: stdin, output: stdout });

try {
  console.log("Games & Castles — trusted Special Reveal fallback");
  console.log(`Target project: ${projectId}`);
  console.log("This is an emergency operator tool; Organizer Mode is primary.");

  let running = true;
  while (running) {
    console.log("\n1 Open reveal\n2 Lock predictions\n3 Reopen predictions");
    console.log("4 Resolve event\n5 Correct result\n6 Reconcile ledger");
    console.log("7 Inspect state\n8 Dry-run resolution preview\n9 Exit");
    const choice = (await prompt.question("Select an action: ")).trim();
    if (choice === "9") {
      running = false;
      continue;
    }
    const data = await load(database);
    if (choice === "7") {
      printState(data, dryRun);
      continue;
    }
    if (choice === "8") {
      const config = required(data.config, "Private configuration is missing.");
      const state = required(data.state, "The event has not opened.");
      const correctOption = await chooseOption(prompt);
      const nextStateRevision =
        state.status === "resolved" ? state.revision : state.revision + 1;
      const nextResolutionRevision =
        state.status === "resolved" ? state.resolutionRevision + 1 : 1;
      const preview = buildPredictionResolution({
        config,
        stateRevision: nextStateRevision,
        resolutionRevision: nextResolutionRevision,
        correctOption,
        predictions: data.predictions,
        participants: data.participants,
        profiles: data.profiles,
        resolvedAt: Date.now(),
        generatedAt: Date.now(),
      });
      console.log(`Valid predictions: ${preview.validPredictions.length}`);
      console.log(`Point entries: ${preview.source.meta.entryCount}`);
      console.log(
        `Source fingerprint: ${preview.source.meta.sourceFingerprint}`,
      );
      continue;
    }

    const now = Date.now();
    const config = data.config;
    const state = data.state;
    let action;
    let eventId;
    let mutation;

    if (choice === "1") {
      const currentConfig = required(
        config,
        "Private configuration is missing.",
      );
      action = "open reveal";
      eventId = currentConfig.eventId;
      mutation = buildOpenRevealMutation({
        config: currentConfig,
        state,
        expectedConfigRevision: currentConfig.revision,
        actorUid: "trusted-local-admin",
        auditId: auditKey(database),
        now,
      });
    } else if (choice === "2" || choice === "3") {
      const currentState = required(state, "The event has not opened.");
      action = choice === "2" ? "lock predictions" : "reopen predictions";
      eventId = currentState.eventId;
      mutation = buildPredictionStateMutation({
        state: currentState,
        expectedStateRevision: currentState.revision,
        action: choice === "2" ? "lock" : "reopen",
        actorUid: "trusted-local-admin",
        auditId: auditKey(database),
        now,
      });
    } else if (choice === "4") {
      const currentConfig = required(
        config,
        "Private configuration is missing.",
      );
      const currentState = required(state, "The event has not opened.");
      const correctOption = await chooseOption(prompt);
      action = "resolve event";
      eventId = currentConfig.eventId;
      mutation = buildResolveRevealMutation({
        ...data,
        config: currentConfig,
        state: currentState,
        correctOption,
        expectedStateRevision: currentState.revision,
        expectedConfigRevision: currentConfig.revision,
        actorUid: "trusted-local-admin",
        auditId: auditKey(database),
        now,
      });
    } else if (choice === "5") {
      const currentConfig = required(
        config,
        "Private configuration is missing.",
      );
      const currentState = required(state, "The event has not opened.");
      const currentResolution = required(
        data.resolution,
        "The event has no published resolution.",
      );
      const correctOption = await chooseOption(prompt);
      action = "correct result";
      eventId = currentConfig.eventId;
      mutation = buildCorrectRevealMutation({
        ...data,
        config: currentConfig,
        state: currentState,
        currentResolution,
        correctOption,
        expectedStateRevision: currentState.revision,
        expectedResolutionRevision: currentState.resolutionRevision,
        actorUid: "trusted-local-admin",
        auditId: auditKey(database),
        now,
      });
    } else if (choice === "6") {
      const currentConfig = required(
        config,
        "Private configuration is missing.",
      );
      const currentState = required(state, "The event has not opened.");
      const currentResolution = required(
        data.resolution,
        "The event has no published resolution.",
      );
      action = "reconcile prediction ledger";
      eventId = currentConfig.eventId;
      mutation = buildReconcilePredictionMutation({
        ...data,
        config: currentConfig,
        state: currentState,
        resolution: currentResolution,
        expectedStateRevision: currentState.revision,
        actorUid: "trusted-local-admin",
        auditId: auditKey(database),
        now,
      });
    } else {
      console.log("Unknown action.");
      continue;
    }

    if (!(await confirm(prompt, projectId, action, dryRun))) {
      console.log("Cancelled; no data changed.");
      continue;
    }
    const withFallbackAudit = addFallbackAudit(
      database,
      mutation,
      action,
      eventId,
      now,
    );
    if (!dryRun && withFallbackAudit.updates)
      await database.ref().update(withFallbackAudit.updates);
    console.log(
      `${
        withFallbackAudit.result.applied
          ? dryRun
            ? "Prepared"
            : "Applied"
          : "No change required"
      }; state revision ${withFallbackAudit.result.stateRevision}.`,
    );
  }
} catch (error) {
  console.error(
    error instanceof Error
      ? `Operation failed: ${error.message}`
      : "Operation failed.",
  );
  process.exitCode = 1;
} finally {
  prompt.close();
}
