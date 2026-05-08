import { saveSession, getSessionToken, clearSession } from "./session";

const AUTH_SITE_URL = "https://www.ziren.store";

type LoginParams = {
  email: string;
  password: string;
  remember: boolean;
};

type DesktopLoginResponse = {
  ok: boolean;
  token?: string;
  user?: {
    id: string;
    username: string;
    email: string;
  };
  error?: string;
};

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

export async function validateSavedSession() {
  const token = getSessionToken();

  if (!token) {
    return null;
  }

  const response = await fetch(`${AUTH_SITE_URL}/api/desktop/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    clearSession();
    return null;
  }

  const data = await response.json();

  if (!data.ok || !data.user) {
    clearSession();
    return null;
  }

  return data.user;
}

export function getProfileUrl() {
  return `${AUTH_SITE_URL}/profile`;
}