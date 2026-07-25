export type ProfileStats = {
  total_commands: number;
  distinct_commands: number;
  member_days: number;
  level: number;
  commands_in_level: number;
  commands_to_next_level: number;
  level_progress_percent: number;
  achievements_unlocked: number;
  achievements_total: number;
};

export type AchievementData = {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
};

export type UserData = {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  created_at?: string;
  last_login_at?: string;
  bio?: string;
  status_text?: string;
  public_profile_enabled?: boolean;
  show_in_community?: boolean;
  activity_tracking_enabled?: boolean;
  ai_context_enabled?: boolean;
  public_profile_url?: string | null;
  stats?: ProfileStats;
  achievements?: AchievementData[];
};

export type SessionData = {
  token: string;
  user: UserData;
};

const SESSION_KEY = "ziren_desktop_session";
const REMEMBER_KEY = "ziren_remember";

export function saveSession(data: SessionData, remember: boolean) {
  const serialized = JSON.stringify(data);

  if (remember) {
    localStorage.setItem(SESSION_KEY, serialized);
    localStorage.setItem(REMEMBER_KEY, "true");
    sessionStorage.removeItem(SESSION_KEY);
  } else {
    sessionStorage.setItem(SESSION_KEY, serialized);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(REMEMBER_KEY);
  }
}

export function getSession(): SessionData | null {
  const raw =
    localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    clearSession();
    return null;
  }
}

export function updateSessionUser(user: UserData) {
  const session = getSession();

  if (!session) {
    return;
  }

  const remember = localStorage.getItem(REMEMBER_KEY) === "true";

  saveSession(
    {
      ...session,
      user,
    },
    remember
  );
}

export function getCurrentUser() {
  return getSession()?.user ?? null;
}

export function getSessionToken() {
  return getSession()?.token ?? null;
}

export function hasSavedSession() {
  return getSession() !== null;
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}
