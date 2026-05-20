const ASSISTANT_API_URL = "http://127.0.0.1:8787";

export type FeatureTriggerInfo = {
  feature_id: string;
  display_name: string;
  plan: string;
  triggers: string[];
};

export type FeatureTriggerDefaultsInfo = {
  feature_id: string;
  default_triggers: string[];
};

type FeatureTriggersResponse = {
  features?: FeatureTriggerInfo[];
};

type FeatureTriggerDefaultsResponse = {
  defaults?: FeatureTriggerDefaultsInfo[];
  features?: FeatureTriggerDefaultsInfo[];
};

type SaveFeatureTriggersResponse =
  | FeatureTriggerInfo
  | {
      feature?: FeatureTriggerInfo;
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

export async function fetchFeatureTriggerDefaults(): Promise<
  FeatureTriggerDefaultsInfo[]
> {
  const response = await fetch(`${ASSISTANT_API_URL}/features/triggers/defaults`);

  if (!response.ok) {
    throw new Error("Не удалось загрузить дефолтные триггеры");
  }

  const data = (await response.json()) as FeatureTriggerDefaultsResponse;

  return data.defaults ?? data.features ?? [];
}

export async function saveFeatureTriggers(
  feature_id: string,
  triggers: string[]
): Promise<FeatureTriggerInfo> {
  const response = await fetch(`${ASSISTANT_API_URL}/features/triggers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ feature_id, triggers }),
  });

  if (!response.ok) {
    throw new Error("Не удалось сохранить триггеры функции");
  }

  const data = (await response.json()) as SaveFeatureTriggersResponse;

  if ("feature" in data && data.feature) {
    return data.feature;
  }

  if ("features" in data && data.features) {
    const updatedFeature = data.features.find(
      (feature) => feature.feature_id === feature_id
    );

    if (updatedFeature) {
      return updatedFeature;
    }
  }

  if ("feature_id" in data) {
    return data;
  }

  throw new Error("Backend вернул неожиданный ответ");
}
