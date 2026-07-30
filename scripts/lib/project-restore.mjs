import { isDeepStrictEqual } from "node:util";
import { classifyAuthUser } from "./project-reset.mjs";

function providerIds(user) {
  return [
    ...new Set(
      (
        user.providerIds ??
        user.providerData?.map((item) => item.providerId) ??
        []
      ).filter(Boolean),
    ),
  ].sort();
}

function backupUserCategory(user) {
  const providers = providerIds(user);
  if (providers.includes("password") && user.customClaims?.admin === true)
    return "organizer";
  if (providers.length === 0) return "anonymous";
  return "other";
}

function claims(user) {
  return user.customClaims ?? {};
}

function persistentUserMatches(backupUser, currentUser) {
  return (
    backupUser.email === (currentUser.email ?? null) &&
    backupUser.emailVerified === currentUser.emailVerified &&
    backupUser.disabled === currentUser.disabled &&
    isDeepStrictEqual(providerIds(backupUser), providerIds(currentUser)) &&
    isDeepStrictEqual(claims(backupUser), claims(currentUser))
  );
}

function isEmptyDatabase(root) {
  return (
    root === null ||
    (typeof root === "object" &&
      !Array.isArray(root) &&
      Object.keys(root).length === 0)
  );
}

function directRecordCount(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value !== "object" || Array.isArray(value)) return 1;
  return Object.keys(value).length;
}

export function summarizeDatabase(root) {
  const branches = Object.entries(root ?? {})
    .map(([path, value]) => ({ path, records: directRecordCount(value) }))
    .sort((left, right) => left.path.localeCompare(right.path));
  return {
    topLevelBranches: branches.length,
    directRecords: branches.reduce(
      (total, branch) => total + branch.records,
      0,
    ),
  };
}

export function restoreConfirmationPhrase(projectId) {
  return `RESTORE ${projectId}`;
}

export function buildDevRestorePlan({ backup, currentDatabase, currentUsers }) {
  if (!backup || !Array.isArray(backup.authUsers))
    throw new Error("The backup payload has no valid Auth metadata array.");
  if (backup.metadata?.authUserCount !== backup.authUsers.length)
    throw new Error("The backup Auth metadata count is inconsistent.");

  const backupByUid = new Map();
  for (const user of backup.authUsers) {
    if (typeof user.uid !== "string" || user.uid === "")
      throw new Error("The backup contains an invalid Auth UID.");
    if (backupByUid.has(user.uid))
      throw new Error("The backup contains duplicate Auth UIDs.");
    backupByUid.set(user.uid, user);
  }

  const currentByUid = new Map(currentUsers.map((user) => [user.uid, user]));
  for (const currentUser of currentUsers) {
    const backupUser = backupByUid.get(currentUser.uid);
    if (!backupUser)
      throw new Error(
        "The target contains an Auth account that is absent from the backup.",
      );
    const backupCategory = backupUserCategory(backupUser);
    const currentCategory = classifyAuthUser(currentUser);
    if (backupCategory !== currentCategory)
      throw new Error("A target Auth account does not match the backup type.");
    if (
      backupCategory !== "anonymous" &&
      !persistentUserMatches(backupUser, currentUser)
    )
      throw new Error(
        "A preserved persistent Auth account differs from the backup.",
      );
  }

  const anonymousUsers = backup.authUsers.filter(
    (user) => backupUserCategory(user) === "anonymous",
  );
  const persistentUsers = backup.authUsers.filter(
    (user) => backupUserCategory(user) !== "anonymous",
  );
  for (const user of persistentUsers) {
    if (!currentByUid.has(user.uid))
      throw new Error(
        "A persistent Auth account from the backup is missing from the target; it cannot be recreated without its credentials.",
      );
  }

  const databaseAlreadyRestored = isDeepStrictEqual(
    currentDatabase,
    backup.database,
  );
  if (!databaseAlreadyRestored && !isEmptyDatabase(currentDatabase))
    throw new Error(
      "The target database is neither empty nor identical to the backup.",
    );

  const anonymousUsersToCreate = anonymousUsers.filter(
    (user) => !currentByUid.has(user.uid),
  );
  return {
    databaseAlreadyRestored,
    database: summarizeDatabase(backup.database),
    anonymousUsers,
    anonymousUsersToCreate,
    anonymousUsersAlreadyRestored:
      anonymousUsers.length - anonymousUsersToCreate.length,
    persistentUsers: persistentUsers.length,
  };
}

export async function applyDevRestore({ database, auth, backup, plan }) {
  for (const user of plan.anonymousUsersToCreate)
    await auth.createUser({ uid: user.uid, disabled: Boolean(user.disabled) });

  for (const user of plan.anonymousUsers) {
    await auth.updateUser(user.uid, { disabled: Boolean(user.disabled) });
    await auth.setCustomUserClaims(
      user.uid,
      Object.keys(claims(user)).length > 0 ? claims(user) : null,
    );
  }

  if (!plan.databaseAlreadyRestored)
    await database.ref().set(backup.database ?? null);

  return {
    databaseRestored: !plan.databaseAlreadyRestored,
    anonymousUsersCreated: plan.anonymousUsersToCreate.length,
  };
}
