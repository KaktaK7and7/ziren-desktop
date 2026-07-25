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
