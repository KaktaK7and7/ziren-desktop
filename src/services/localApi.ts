export const ASSISTANT_API_URL = "http://127.0.0.1:8787";

const LOCAL_TOKEN_HEADER = "X-Ziren-Local-Token";
let localApiToken = "";


export function ensureLocalApiToken() {
  if (localApiToken) {
    return localApiToken;
  }

  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  localApiToken = Array.from(
    bytes,
    (value) => value.toString(16).padStart(2, "0")
  ).join("");

  return localApiToken;
}


export function clearLocalApiToken() {
  localApiToken = "";
}

function wait(delayMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

export async function fetchAssistantApi(
  path: string,
  init: RequestInit = {}
) {
  if (!localApiToken) {
    throw new Error("Local assistant API is not initialized");
  }

  const headers = new Headers(init.headers);
  headers.set(LOCAL_TOKEN_HEADER, localApiToken);

  return fetch(`${ASSISTANT_API_URL}${path}`, {
    ...init,
    headers,
  });
}

export async function waitForAssistantApi(timeoutMs = 90_000) {
  const startedAt = Date.now();
  let lastError: unknown = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetchAssistantApi("/health");

      if (response.ok) {
        return;
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "На компьютере уже запущено ядро Ziren с другой сессией. "
          + "Полностью закрой Ziren через трей и запусти приложение снова",
        );
      }

      lastError = new Error(
        `Локальное ядро вернуло HTTP ${response.status}`,
      );
    } catch (error) {
      if (
        error instanceof Error
        && error.message.includes("другой сессией")
      ) {
        throw error;
      }

      lastError = error;
    }

    await wait(500);
  }

  const detail =
    lastError instanceof Error ? `: ${lastError.message}` : "";

  throw new Error(
    `Локальное ядро Ziren не запустилось за ${Math.round(timeoutMs / 1000)} секунд${detail}`,
  );
}
