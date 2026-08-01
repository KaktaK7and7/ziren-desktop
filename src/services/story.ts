import {
  fetchAuthenticatedAuthApi,
  readAuthApiJson,
} from "./auth";

export type StoryRelationship = {
  trust: number;
  closeness: number;
  autonomy: number;
  caution: number;
};

export type StoryPrompt = {
  id: string;
  eyebrow: string;
  prompt: string;
  quote: string;
};

export type StoryNode = {
  id: string;
  type:
    | "fragment"
    | "choice"
    | "path"
    | "memory"
    | "bond"
    | "scar"
    | "mystery";
  title: string;
  subtitle: string;
  description: string;
  status:
    | "active"
    | "available"
    | "unlocked"
    | "discovered"
    | "hidden"
    | "missed";
  x: number;
  y: number;
  parent_ids: string[];
};

export type MelissaStory = {
  version: number;
  story_mode: {
    enabled: boolean;
    label: string;
    personality_source: "living_story" | "persona_preset";
    character_locked: boolean;
    note: string;
  };
  season: {
    number: number;
    title: string;
    status: string;
  };
  chapter: string;
  path: {
    id: string;
    title: string;
    stance: string;
    description: string;
  };
  companion_name: string;
  romance: {
    enabled: boolean;
    available: boolean;
    note: string;
  };
  relationship: StoryRelationship;
  prologue: {
    step: number;
    total_steps: number;
    completed: boolean;
    next_prompt: StoryPrompt | null;
    last_response: string;
    interaction_mode: "dialogue";
  };
  dialogue: {
    next_prompt: StoryPrompt | null;
    interaction_mode: "dialogue";
  };
  choices: Record<string, string>;
  current_node_id: string;
  graph: {
    width: number;
    height: number;
    layout: "relationship-web";
  };
  nodes: StoryNode[];
};

type StoryResponse = {
  ok: boolean;
  story?: MelissaStory;
  error?: string;
};

export type PersonaPresetOption = {
  id: string;
  title: string;
  description: string;
};

type PersonaPresetsResponse = {
  ok: boolean;
  selected: string | null;
  presets: PersonaPresetOption[];
  story_mode: MelissaStory["story_mode"];
  error?: string;
};

async function readStoryResponse(response: Response) {
  const data = await readAuthApiJson<StoryResponse>(
    response,
    "Не удалось загрузить Хронику связи",
  );

  if (!response.ok || !data.ok || !data.story) {
    if (response.status === 401) {
      throw new Error(
        "Сессия Ziren устарела. Выйди из аккаунта и войди снова",
      );
    }

    throw new Error(
      data.error || "Не удалось загрузить Хронику связи",
    );
  }

  return data.story;
}

export async function fetchMelissaStory() {
  const response = await fetchAuthenticatedAuthApi("/api/assistant/story");
  return readStoryResponse(response);
}

export async function updateMelissaStoryMode(enabled: boolean) {
  const response = await fetchAuthenticatedAuthApi(
    "/api/assistant/story/mode",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    },
  );

  return readStoryResponse(response);
}

export async function fetchPersonaPresets() {
  const response = await fetchAuthenticatedAuthApi(
    "/api/assistant/persona/presets",
  );
  const data = await readAuthApiJson<PersonaPresetsResponse>(
    response,
    "Не удалось загрузить характеры компаньона",
  );

  if (!response.ok || !data.ok || !Array.isArray(data.presets)) {
    throw new Error(
      data.error || "Не удалось загрузить характеры компаньона",
    );
  }

  return data;
}

export async function applyPersonaPreset(presetName: string) {
  const response = await fetchAuthenticatedAuthApi(
    "/api/assistant/preset",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preset_name: presetName }),
    },
  );
  const data = await readAuthApiJson<{ ok?: boolean; error?: string }>(
    response,
    "Не удалось сохранить характер компаньона",
  );

  if (!response.ok) {
    throw new Error(
      data.error || "Не удалось сохранить характер компаньона",
    );
  }

  return data;
}

export async function resetMelissaCompanion() {
  const response = await fetchAuthenticatedAuthApi(
    "/api/assistant/reset",
    { method: "POST" },
  );
  return readStoryResponse(response);
}
