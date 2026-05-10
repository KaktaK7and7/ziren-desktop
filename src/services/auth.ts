import {
  saveSession,
  getSessionToken,
  clearSession,
  updateSessionUser,
  type UserData,
} from "./session";

const AUTH_SITE_URL = "https://www.ziren.store";

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

  const data = (await response.json()) as DesktopLoginResponse;

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

  const data = (await response.json()) as DesktopMeResponse;

  if (!response.ok || !data.ok || !data.user) {
    throw new Error(data.error || "Не удалось загрузить профиль");
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