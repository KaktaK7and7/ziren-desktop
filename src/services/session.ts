export type SessionData = {
  userId: string;
  sessionId: string;
};

const USER_ID_KEY = "ziren_user_id";
const SESSION_ID_KEY = "ziren_session_id";
const REMEMBER_KEY = "ziren_remember";

export function saveSession(data: SessionData, remember: boolean) {
  if (remember) {
    localStorage.setItem(USER_ID_KEY, data.userId);
    localStorage.setItem(SESSION_ID_KEY, data.sessionId);
    localStorage.setItem(REMEMBER_KEY, "true");
  } else {
    sessionStorage.setItem(USER_ID_KEY, data.userId);
    sessionStorage.setItem(SESSION_ID_KEY, data.sessionId);
    localStorage.removeItem(REMEMBER_KEY);
  }
}

export function hasSavedSession() {
  const remember = localStorage.getItem(REMEMBER_KEY) === "true";

  if (remember) {
    return Boolean(
      localStorage.getItem(USER_ID_KEY) &&
        localStorage.getItem(SESSION_ID_KEY)
    );
  }

  return Boolean(
    sessionStorage.getItem(USER_ID_KEY) &&
      sessionStorage.getItem(SESSION_ID_KEY)
  );
}

export function clearSession() {
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(SESSION_ID_KEY);
  localStorage.removeItem(REMEMBER_KEY);

  sessionStorage.removeItem(USER_ID_KEY);
  sessionStorage.removeItem(SESSION_ID_KEY);
}

export function getSession(): SessionData | null {
  const userId =
    localStorage.getItem(USER_ID_KEY) || sessionStorage.getItem(USER_ID_KEY);

  const sessionId =
    localStorage.getItem(SESSION_ID_KEY) ||
    sessionStorage.getItem(SESSION_ID_KEY);

  if (!userId || !sessionId) {
    return null;
  }

  return {
    userId,
    sessionId,
  };
}