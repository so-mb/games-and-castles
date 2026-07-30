const DELETE_BATCH_SIZE = 1000;
const MAX_DELETE_PASSES = 5;

export function resetConfirmationPhrase(projectId) {
  return `RESET ${projectId}`;
}

function providerIds(user) {
  return [
    ...new Set(
      (user.providerData ?? [])
        .map((provider) => provider.providerId)
        .filter(Boolean),
    ),
  ].sort();
}

export function classifyAuthUser(user) {
  const providers = providerIds(user);
  if (providers.includes("password") && user.customClaims?.admin === true)
    return "organizer";
  if (providers.length === 0) return "anonymous";
  return "other";
}

function directRecordCount(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value !== "object" || Array.isArray(value)) return 1;
  return Object.keys(value).length;
}

export function buildProjectResetPreview(root, users) {
  const databaseBranches = Object.entries(root ?? {})
    .map(([path, value]) => ({ path, records: directRecordCount(value) }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const auth = { anonymous: 0, organizers: 0, other: 0 };
  const otherAccounts = [];
  for (const user of users) {
    const category = classifyAuthUser(user);
    if (category === "organizer") auth.organizers += 1;
    else auth[category] += 1;
    if (category === "other")
      otherAccounts.push({
        uid: user.uid,
        email: user.email ?? null,
        providerIds: providerIds(user),
      });
  }
  otherAccounts.sort((left, right) =>
    (left.email ?? left.uid).localeCompare(right.email ?? right.uid),
  );
  return {
    database: {
      branches: databaseBranches,
      topLevelBranches: databaseBranches.length,
      directRecords: databaseBranches.reduce(
        (total, branch) => total + branch.records,
        0,
      ),
    },
    auth: { total: users.length, ...auth, otherAccounts },
  };
}

export async function listAllAuthUsers(auth) {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

async function deleteAnonymousUsers(auth) {
  let deleted = 0;
  for (let pass = 0; pass < MAX_DELETE_PASSES; pass += 1) {
    const users = await listAllAuthUsers(auth);
    const anonymousUids = users
      .filter((user) => classifyAuthUser(user) === "anonymous")
      .map((user) => user.uid);
    if (anonymousUids.length === 0) return deleted;
    for (
      let index = 0;
      index < anonymousUids.length;
      index += DELETE_BATCH_SIZE
    ) {
      const result = await auth.deleteUsers(
        anonymousUids.slice(index, index + DELETE_BATCH_SIZE),
      );
      deleted += result.successCount;
      if (result.failureCount > 0)
        throw new Error(
          `Firebase could not delete ${result.failureCount} anonymous Auth account(s); rerun the reset after reviewing the local Admin SDK error.`,
        );
    }
  }
  throw new Error(
    "Anonymous Auth accounts are still appearing after repeated deletion passes; stop sign-ins and rerun the reset.",
  );
}

export async function resetProjectData({ database, auth }) {
  await database.ref().remove();
  const anonymousUsersDeleted = await deleteAnonymousUsers(auth);
  return { databaseCleared: true, anonymousUsersDeleted };
}
