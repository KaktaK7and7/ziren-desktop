import { fetchAuthenticatedAuthApi } from "./auth";

export type StoryRelationship = {
  trust: number;
  autonomy: number;
  caution: number;
};

export type StoryChoiceOption = {
  id: string;
  label: string;
  description: string;
  requiresName?: boolean;
};

export type StoryChoice = {
  id: string;
  step: number;
  eyebrow: string;
  prompt: string;
  quote: string;
  options: StoryChoiceOption[];
};

export type StoryNode = {
  id: string;
  type: "fragment" | "choice" | "memory" | "scar" | "mystery";
  title: string;
  subtitle: string;
  description: string;
  status: "unlocked" | "discovered" | "hidden";
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
    next_choice: StoryChoice | null;
    last_response: string;
  };
  choices: Record<string, string>;
  nodes: StoryNode[];
};

type StoryResponse = {
  ok: boolean;
  story?: MelissaStory;
  error?: string;
};

async function readStoryResponse(response: Response) {
  const data = (await response.json()) as StoryResponse;

  if (!response.ok || !data.ok || !data.story) {
    throw new Error(data.error || "Не удалось загрузить Хронику связи");
  }

  return data.story;
}

export async function fetchMelissaStory() {
  const response = await fetchAuthenticatedAuthApi("/api/assistant/story");
  return readStoryResponse(response);
}

export async function recordMelissaStoryChoice(params: {
  choiceId: string;
  optionId: string;
  customName?: string;
}) {
  const response = await fetchAuthenticatedAuthApi(
    "/api/assistant/story/choices",
    {
      method: "POST",
      body: JSON.stringify({
        choice_id: params.choiceId,
        option_id: params.optionId,
        custom_name: params.customName || "",
      }),
    },
  );

  return readStoryResponse(response);
}
