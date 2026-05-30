import { ASSISTANT_API_URL } from "./assistantEvents";

export type AppLauncherTarget = {
  target_id: string;
  name: string;
  type: "steam" | "shortcut" | "exe" | "system" | string;
  source: string;
  launch_uri: string | null;
  path: string | null;
  appid: string | null;
  spoken_name: string | null;
  aliases: string[];
};

type AppsResponse = {
  apps?: AppLauncherTarget[];
};

export async function fetchAppLauncherApps(): Promise<AppLauncherTarget[]> {
  const response = await fetch(`${ASSISTANT_API_URL}/app-launcher/apps`);

  if (!response.ok) {
    throw new Error("Failed to load app launcher apps");
  }

  const data = (await response.json()) as AppsResponse;
  return data.apps ?? [];
}

export async function saveAppLauncherApp(
  app: Partial<AppLauncherTarget>
): Promise<AppLauncherTarget[]> {
  const response = await fetch(`${ASSISTANT_API_URL}/app-launcher/apps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(app),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : "Failed to save app launcher app"
    );
  }

  const data = (await response.json()) as AppsResponse;
  return data.apps ?? [];
}

export async function cleanupAppLauncherApps(): Promise<AppLauncherTarget[]> {
  const response = await fetch(`${ASSISTANT_API_URL}/app-launcher/apps/cleanup`, {
    method: "POST",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : "Failed to clean app launcher apps"
    );
  }

  const data = (await response.json()) as AppsResponse;
  return data.apps ?? [];
}

export async function deleteAppLauncherApp(
  targetId: string
): Promise<AppLauncherTarget[]> {
  const response = await fetch(
    `${ASSISTANT_API_URL}/app-launcher/apps/${encodeURIComponent(targetId)}`,
    { method: "DELETE" }
  );

  if (!response.ok) {
    throw new Error("Failed to delete app launcher app");
  }

  const data = (await response.json()) as AppsResponse;
  return data.apps ?? [];
}

export async function addAppLauncherAlias(
  alias: string,
  targetId: string
): Promise<AppLauncherTarget[]> {
  const response = await fetch(`${ASSISTANT_API_URL}/app-launcher/aliases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alias, target_id: targetId }),
  });

  if (!response.ok) {
    throw new Error("Failed to add app launcher alias");
  }

  const data = (await response.json()) as AppsResponse;
  return data.apps ?? [];
}

export async function deleteAppLauncherAlias(
  alias: string
): Promise<AppLauncherTarget[]> {
  const response = await fetch(`${ASSISTANT_API_URL}/app-launcher/aliases`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alias }),
  });

  if (!response.ok) {
    throw new Error("Failed to delete app launcher alias");
  }

  const data = (await response.json()) as AppsResponse;
  return data.apps ?? [];
}
