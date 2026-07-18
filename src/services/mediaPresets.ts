import { ASSISTANT_API_URL } from "./assistantEvents";

export type MusicPreset = {
  preset_id: string;
  name: string;
  url: string;
  aliases: string[];
  enabled: boolean;
};

type PresetsResponse = {
  presets?: MusicPreset[];
  error?: string;
};

async function readError(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  return typeof data?.error === "string" ? data.error : fallback;
}

export async function fetchMediaPresets(): Promise<MusicPreset[]> {
  const response = await fetch(`${ASSISTANT_API_URL}/media/presets`);

  if (!response.ok) {
    throw new Error("Failed to load music presets");
  }

  const data = (await response.json()) as PresetsResponse;
  return normalizePresets(data.presets ?? []);
}

export async function saveMediaPreset(
  preset: Partial<MusicPreset>
): Promise<MusicPreset[]> {
  const response = await fetch(`${ASSISTANT_API_URL}/media/presets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(preset),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Failed to save music preset"));
  }

  const data = (await response.json()) as PresetsResponse;
  return normalizePresets(data.presets ?? []);
}

export async function deleteMediaPreset(
  presetId: string
): Promise<MusicPreset[]> {
  const response = await fetch(
    `${ASSISTANT_API_URL}/media/presets/${encodeURIComponent(presetId)}`,
    { method: "DELETE" }
  );

  if (!response.ok) {
    throw new Error(await readError(response, "Failed to delete music preset"));
  }

  const data = (await response.json()) as PresetsResponse;
  return normalizePresets(data.presets ?? []);
}

export async function testMediaPreset(params: { url: string }): Promise<void> {
  const response = await fetch(`${ASSISTANT_API_URL}/media/presets/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Failed to test music preset"));
  }
}

function normalizePresets(presets: Array<MusicPreset & Record<string, unknown>>): MusicPreset[] {
  return presets.map((preset) => ({
    preset_id: String(preset.preset_id ?? ""),
    name: String(preset.name ?? ""),
    url: String(preset.url ?? ""),
    aliases: Array.isArray(preset.aliases)
      ? preset.aliases.filter((alias): alias is string => typeof alias === "string")
      : [],
    enabled: Boolean(preset.enabled ?? true),
  }));
}
