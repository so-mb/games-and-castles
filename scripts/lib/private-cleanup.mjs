export const PRIVATE_CLEANUP_PATHS = [
  "birthdayVault/privateMessages",
  "birthdayVault/moderation",
  "birthdayVault/submissionReceipts",
  "specialReveal/privateConfig",
  "specialReveal/predictions",
  "specialReveal/predictionReceipts",
];

function valueAt(root, path) {
  return path.split("/").reduce((value, segment) => value?.[segment], root);
}

function count(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  return Object.keys(value).length;
}

export function privateCleanupPreview(root) {
  return PRIVATE_CLEANUP_PATHS.map((path) => ({
    path,
    records: count(valueAt(root, path)),
  }));
}

export function buildPrivateCleanupMutation({ root, auditId, now }) {
  const preview = privateCleanupPreview(root);
  if (preview.every((item) => item.records === 0))
    return { applied: false, preview, updates: null };
  const updates = Object.fromEntries(
    PRIVATE_CLEANUP_PATHS.map((path) => [path, null]),
  );
  updates[`audit/${auditId}`] = {
    id: auditId,
    action: "private-data-purged",
    entityType: "privacy-cleanup",
    entityId: "post-event-private-data",
    actorUid: "trusted-local-admin",
    occurredAt: now,
    summary:
      "Post-event private data removed after encrypted backup verification.",
    schemaVersion: 1,
  };
  return { applied: true, preview, updates };
}
