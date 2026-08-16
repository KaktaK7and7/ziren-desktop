import { fetchAssistantApi } from "./localApi";

export type FeatureTriggerGroup = {
  action_id: string;
  display_name: string;
  triggers: string[];
  argument_hint?: string;
  melissa_semantic?: boolean;
  snake_triggers?: boolean;
};

export type FeatureTriggerInfo = {
  feature_id: string;
  display_name: string;
  plan: string;
  triggers?: string[];
  trigger_groups: FeatureTriggerGroup[];
};

export type FeatureTriggerDefaultsInfo = {
  feature_id: string;
  display_name: string;
  plan: string;
  default_trigger_groups: FeatureTriggerGroup[];
};

type RawFeatureTriggerInfo = Omit<FeatureTriggerInfo, "trigger_groups"> & {
  trigger_groups?: FeatureTriggerGroup[];
};

type RawFeatureTriggerDefaultsInfo = Omit<
  FeatureTriggerDefaultsInfo,
  "default_trigger_groups"
> & {
  default_trigger_groups?: FeatureTriggerGroup[];
  default_triggers?: string[];
};

type FeatureTriggersResponse = {
  features?: RawFeatureTriggerInfo[];
};

type FeatureTriggerDefaultsResponse = {
  defaults?: RawFeatureTriggerDefaultsInfo[];
  features?: RawFeatureTriggerDefaultsInfo[];
};

type SaveFeatureTriggersResponse =
  | RawFeatureTriggerInfo
  | {
      feature?: RawFeatureTriggerInfo;
      features?: RawFeatureTriggerInfo[];
    };

export async function fetchFeatureTriggers(): Promise<FeatureTriggerInfo[]> {
  const response = await fetchAssistantApi("/features/triggers");

  if (!response.ok) {
    throw new Error("Не удалось загрузить триггеры функций");
  }

  const data = (await response.json()) as FeatureTriggersResponse;

  return (data.features ?? []).map(normalizeFeature);
}

export async function fetchFeatureTriggerDefaults(): Promise<
  FeatureTriggerDefaultsInfo[]
> {
  const response = await fetchAssistantApi("/features/triggers/defaults");

  if (!response.ok) {
    throw new Error("Не удалось загрузить дефолтные триггеры");
  }

  const data = (await response.json()) as FeatureTriggerDefaultsResponse;

  return (data.defaults ?? data.features ?? []).map(normalizeDefaults);
}

export async function saveFeatureTriggers(
  feature_id: string,
  triggerGroups: FeatureTriggerGroup[]
): Promise<FeatureTriggerInfo> {
  const trigger_groups = Object.fromEntries(
    triggerGroups.map((group) => [group.action_id, group.triggers])
  );

  const response = await fetchAssistantApi("/features/triggers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ feature_id, trigger_groups }),
  });

  if (!response.ok) {
    throw new Error("Не удалось сохранить триггеры функции");
  }

  const data = (await response.json()) as SaveFeatureTriggersResponse;

  if ("feature" in data && data.feature) {
    return normalizeFeature(data.feature);
  }

  if ("features" in data && data.features) {
    const updatedFeature = data.features.find(
      (feature) => feature.feature_id === feature_id
    );

    if (updatedFeature) {
      return normalizeFeature(updatedFeature);
    }
  }

  if ("feature_id" in data) {
    return normalizeFeature(data);
  }

  throw new Error("Backend вернул неожиданный ответ");
}

function normalizeFeature(feature: RawFeatureTriggerInfo): FeatureTriggerInfo {
  const triggerGroups =
    feature.trigger_groups && feature.trigger_groups.length > 0
      ? feature.trigger_groups
      : buildLegacyGroups(feature.triggers ?? []);

  return {
    ...feature,
    trigger_groups: triggerGroups,
  };
}

function normalizeDefaults(
  feature: RawFeatureTriggerDefaultsInfo
): FeatureTriggerDefaultsInfo {
  const defaultTriggerGroups =
    feature.default_trigger_groups && feature.default_trigger_groups.length > 0
      ? feature.default_trigger_groups
      : buildLegacyGroups(feature.default_triggers ?? []);

  return {
    feature_id: feature.feature_id,
    display_name: feature.display_name,
    plan: feature.plan,
    default_trigger_groups: defaultTriggerGroups,
  };
}

function buildLegacyGroups(triggers: string[]): FeatureTriggerGroup[] {
  return [
    {
      action_id: "__legacy__",
      display_name: "Общие триггеры",
      triggers,
      melissa_semantic: false,
      snake_triggers: true,
    },
  ];
}
