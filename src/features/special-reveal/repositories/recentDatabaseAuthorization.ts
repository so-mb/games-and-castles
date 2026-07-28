const DEFAULT_RETRY_DELAYS_MS = [0, 100, 250, 500, 1000, 2000] as const;

function errorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

export function isDatabasePermissionDenied(error: unknown) {
  const code = errorCode(error);
  if (code === "database/permission-denied" || code === "PERMISSION_DENIED")
    return true;
  return (
    error instanceof Error && /permission[ _-]?denied/i.test(error.message)
  );
}

function wait(delayMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

export async function waitForRecentDatabaseAuthorization(input: {
  readProbe: () => Promise<unknown>;
  wait?: (delayMs: number) => Promise<void>;
  retryDelaysMs?: readonly number[];
}) {
  const waitForDelay = input.wait ?? wait;
  const delays = input.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  let lastPermissionError: unknown;

  for (const delayMs of delays) {
    if (delayMs > 0) await waitForDelay(delayMs);
    try {
      await input.readProbe();
      return;
    } catch (error) {
      if (!isDatabasePermissionDenied(error)) throw error;
      lastPermissionError = error;
    }
  }

  throw new Error(
    "Firebase Database did not accept the refreshed organizer session. Wait a moment and try again; sign out and back in if it continues.",
    { cause: lastPermissionError },
  );
}
