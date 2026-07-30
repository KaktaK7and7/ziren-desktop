import {
  saveSession,
  getSessionToken,
  clearSession,
  updateSessionUser,
  type UserData,
} from "./session";

const PRODUCTION_AUTH_SITE_URL = "https://www.ziren.store";
const DEVELOPMENT_AUTH_SITE_URL =
  "https://auth-site-p0-security-test.up.railway.app";

function getAuthSiteUrl() {
  if (!import.meta.env.DEV) {
    return PRODUCTION_AUTH_SITE_URL;
  }

  const configuredUrl = String(
    import.meta.env.VITE_AUTH_SITE_URL || DEVELOPMENT_AUTH_SITE_URL
  ).trim();
  const parsedUrl = new URL(configuredUrl);
  const isLocalHttp =
    parsedUrl.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(parsedUrl.hostname);

  if (parsedUrl.protocol !== "https:" && !isLocalHttp) {
    throw new Error(
      "VITE_AUTH_SITE_URL must use HTTPS or local HTTP"
    );
  }

  if (
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.search ||
    parsedUrl.hash ||
    (parsedUrl.pathname !== "/" && parsedUrl.pathname !== "")
  ) {
    throw new Error(
      "VITE_AUTH_SITE_URL must contain only the service origin"
    );
  }

  return parsedUrl.origin;
}

const AUTH_SITE_URL = getAuthSiteUrl();

export function getAuthSiteOrigin() {
  return AUTH_SITE_URL;
}

export async function readAuthApiJson<T>(
  response: Response,
  fallbackMessage: string,
) {
  const rawBody = await response.text();

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    if (response.status === 404) {
      throw new Error(
        `${fallbackMessage}: сервер Ziren ещё не обновлён`,
      );
    }

    throw new Error(
      `${fallbackMessage}: сервер вернул некорректный ответ`,
    );
  }
}

export async function fetchAuthenticatedAuthApi(
  path: string,
  init: RequestInit = {},
) {
  const token = getSessionToken();

  if (!token) {
    throw new Error("Нет токена авторизации");
  }

  try {
    return await fetch(`${AUTH_SITE_URL}${path}`, {
      ...init,
      headers: {
        ...(init.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error(
      `Не удалось подключиться к серверу Ziren (${AUTH_SITE_URL})`,
    );
  }
}

type LoginParams = {
  email: string;
  password: string;
  remember: boolean;
};

type DesktopLoginResponse = {
  ok: boolean;
  token?: string;
  user?: UserData;
  error?: string;
};

type DesktopMeResponse = {
  ok: boolean;
  user?: UserData;
  error?: string;
};

export function resolveAuthAssetUrl(url?: string) {
  if (!url) {
    return "";
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `${AUTH_SITE_URL}${url}`;
}

export function getProfileUrl() {
  return `${AUTH_SITE_URL}/profile`;
}

export function getRegisterUrl() {
  return `${AUTH_SITE_URL}/register.html`;
}

export async function loginUser(params: LoginParams) {
  const email = params.email.trim();
  const password = params.password.trim();

  if (!email || !password) {
    throw new Error("Введите email и пароль");
  }

  const response = await fetch(`${AUTH_SITE_URL}/api/desktop/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      remember: params.remember,
    }),
  });

  const data = await readAuthApiJson<DesktopLoginResponse>(
    response,
    "Ошибка входа",
  );

  if (!response.ok || !data.ok || !data.token || !data.user) {
    throw new Error(data.error || "Ошибка входа");
  }

  const session = {
    token: data.token,
    user: data.user,
  };

  saveSession(session, params.remember);

  return session;
}

export async function fetchDesktopProfile() {
  const token = getSessionToken();

  if (!token) {
    throw new Error("Нет токена авторизации");
  }

  const response = await fetch(`${AUTH_SITE_URL}/api/desktop/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await readAuthApiJson<DesktopMeResponse>(
    response,
    "Не удалось загрузить профиль",
  );

  if (!response.ok || !data.ok || !data.user) {
    throw new Error(data.error || "Не удалось загрузить профиль");
  }

  updateSessionUser(data.user);

  return data.user;
}

export async function updateDesktopPreferences(preferences: {
  activity_tracking_enabled: boolean;
  ai_context_enabled: boolean;
}) {
  const response = await fetchAuthenticatedAuthApi(
    "/api/desktop/preferences",
    {
      method: "PATCH",
      body: JSON.stringify(preferences),
    },
  );
  const data = await readAuthApiJson<DesktopMeResponse>(
    response,
    "Не удалось сохранить настройки приватности",
  );

  if (!response.ok || !data.ok || !data.user) {
    throw new Error(
      data.error || "Не удалось сохранить настройки приватности",
    );
  }

  updateSessionUser(data.user);
  return data.user;
}

export async function validateSavedSession() {
  try {
    return await fetchDesktopProfile();
  } catch {
    clearSession();
    return null;
  }
}


export async function logoutUser() {
  const token = getSessionToken();

  try {
    if (token) {
      await fetch(`${AUTH_SITE_URL}/api/desktop/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    }
  } finally {
    clearSession();
  }
}


export async function uploadDesktopAvatar(file: File) {
  const token = getSessionToken();

  if (!token) {
    throw new Error("Нет токена авторизации");
  }

  const formData = new FormData();
  formData.append("avatar", file);

  const response = await fetch(`${AUTH_SITE_URL}/api/desktop/avatar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await readAuthApiJson<DesktopMeResponse>(
    response,
    "Не удалось загрузить аватарку",
  );

  if (!response.ok || !data.ok || !data.user) {
    throw new Error(data.error || "Не удалось загрузить аватарку");
  }

  updateSessionUser(data.user);

  return data.user;
}
