import { fetchAssistantApi } from "./localApi";

export type CompanionSettings = {
  melissa_command_mode_enabled: boolean;
  snake_command_mode_enabled: boolean;
  command_reactions_enabled: boolean;
  command_reaction_chance: number;
  command_reaction_cooldown_minutes: number;
  proactive_dialogue_enabled: boolean;
  proactive_idle_min_minutes: number;
  proactive_idle_max_minutes: number;
  quiet_hours_enabled: boolean;
  quiet_hours_start: number;
  quiet_hours_end: number;
};

type CompanionSettingsResponse = {
  ok?: boolean;
  settings?: CompanionSettings;
  error?: string;
};

async function readSettingsResponse(response: Response) {
  const data = (await response.json()) as CompanionSettingsResponse;

  if (!response.ok || !data.ok || !data.settings) {
    throw new Error(data.error || "Не удалось загрузить настройки компаньона");
  }

  return data.settings;
}

export async function fetchCompanionSettings() {
  const response = await fetchAssistantApi("/companion/settings");
  return readSettingsResponse(response);
}

export async function saveCompanionSettings(settings: CompanionSettings) {
  const response = await fetchAssistantApi("/companion/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  return readSettingsResponse(response);
}
