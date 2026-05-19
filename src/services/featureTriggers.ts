const ASSISTANT_API_URL = "http://127.0.0.1:8787";

export type FeatureTriggerInfo = {
  feature_id: string;
  display_name: string;
  plan: string;
  triggers: string[];
};

type FeatureTriggersResponse = {
  features?: FeatureTriggerInfo[];
};

export async function fetchFeatureTriggers(): Promise<FeatureTriggerInfo[]> {
  const response = await fetch(`${ASSISTANT_API_URL}/features/triggers`);

  if (!response.ok) {
    throw new Error("Не удалось загрузить триггеры функций");
  }

  const data = (await response.json()) as FeatureTriggersResponse;

  return data.features ?? [];
}
