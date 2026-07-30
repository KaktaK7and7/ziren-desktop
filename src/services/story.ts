import {
  fetchAuthenticatedAuthApi,
  readAuthApiJson,
} from "./auth";

export type StoryRelationship = {
  trust: number;
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
  type: "fragment" | "choice" | "path" | "memory" | "scar" | "mystery";
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
  season: {
    number: number;
    title: string;
    status: string;
  };
  chapter: string;
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
  };
  nodes: StoryNode[];
};

type StoryResponse = {
  ok: boolean;
  story?: MelissaStory;
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
