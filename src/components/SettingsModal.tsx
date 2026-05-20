import { useEffect, useMemo, useState, type MouseEvent } from "react";

import {
  fetchFeatureTriggerDefaults,
  fetchFeatureTriggers,
  saveFeatureTriggers,
  type FeatureTriggerDefaultsInfo,
  type FeatureTriggerGroup,
  type FeatureTriggerInfo,
} from "../services/featureTriggers";

import "./SettingsModal.css";

type Props = {
  onClose: () => void;
};

type SettingsSection = {
  id: string;
  label: string;
  disabled?: boolean;
};

const LEGACY_ACTION_ID = "__legacy__";

const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "triggers", label: "Триггеры" },
  { id: "voice", label: "Голос", disabled: true },
  { id: "interface", label: "Интерфейс", disabled: true },
  { id: "neural", label: "Нейросеть", disabled: true },
  { id: "account", label: "Аккаунт", disabled: true },
  { id: "system", label: "Система", disabled: true },
];

export default function SettingsModal({ onClose }: Props) {
  const [features, setFeatures] = useState<FeatureTriggerInfo[]>([]);
  const [defaults, setDefaults] = useState<FeatureTriggerDefaultsInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [defaultsError, setDefaultsError] = useState("");
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});
  const [expandedFeatures, setExpandedFeatures] = useState<
    Record<string, boolean>
  >({});
  const [newTriggerValues, setNewTriggerValues] = useState<
    Record<string, string>
  >({});
  const [activeSection, setActiveSection] = useState("triggers");

  const defaultsByFeatureId = useMemo(() => {
    return new Map(
      defaults.map((featureDefaults) => [
        featureDefaults.feature_id,
        new Map(
          featureDefaults.default_trigger_groups.map((group) => [
            group.action_id,
            group,
          ])
        ),
      ])
    );
  }, [defaults]);

  useEffect(() => {
    let mounted = true;

    async function loadFeatureTriggers() {
      let featuresLoaded = false;

      try {
        setIsLoading(true);
        setError("");
        setDefaultsError("");

        const defaultsRequest = fetchFeatureTriggerDefaults().then(
          (result) => ({ result }),
          (requestError: unknown) => ({ requestError })
        );
        const loadedFeatures = await fetchFeatureTriggers();

        featuresLoaded = true;

        if (mounted) {
          setFeatures(loadedFeatures);
          setIsLoading(false);
        }

        try {
          const defaultsResult = await defaultsRequest;

          if ("requestError" in defaultsResult) {
            throw defaultsResult.requestError;
          }

          if (mounted) {
            setDefaults(defaultsResult.result);
          }
        } catch (err) {
          if (mounted) {
            setDefaults([]);
            setDefaultsError(
              err instanceof Error
                ? err.message
                : "Дефолтные триггеры недоступны"
            );
          }
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Assistant backend недоступен"
          );
        }
      } finally {
        if (mounted && !featuresLoaded) {
          setIsLoading(false);
        }
      }
    }

    loadFeatureTriggers();

    return () => {
      mounted = false;
    };
  }, []);

  function handlePanelClick(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  function actionKey(featureId: string, actionId: string) {
    return `${featureId}:${actionId}`;
  }

  function toggleFeature(featureId: string) {
    setExpandedFeatures((current) => ({
      ...current,
      [featureId]: !current[featureId],
    }));
  }

  function normalizeTriggers(triggers: string[]) {
    const normalizedTriggers = triggers
      .map((trigger) => trigger.trim().toLowerCase())
      .filter(Boolean);

    return Array.from(new Set(normalizedTriggers));
  }

  function updateFeature(updatedFeature: FeatureTriggerInfo) {
    setFeatures((currentFeatures) =>
      currentFeatures.map((feature) =>
        feature.feature_id === updatedFeature.feature_id
          ? updatedFeature
          : feature
      )
    );
  }

  function getDefaultGroup(featureId: string, actionId: string) {
    return defaultsByFeatureId.get(featureId)?.get(actionId);
  }

  function isEditableAction(featureId: string, actionId: string) {
    return actionId !== LEGACY_ACTION_ID && Boolean(getDefaultGroup(featureId, actionId));
  }

  function buildUpdatedGroups(
    feature: FeatureTriggerInfo,
    actionId: string,
    triggers: string[]
  ) {
    return feature.trigger_groups
      .filter((group) => group.action_id !== LEGACY_ACTION_ID)
      .map((group) =>
        group.action_id === actionId
          ? { ...group, triggers: normalizeTriggers(triggers) }
          : group
      );
  }

  async function persistFeatureGroups(
    feature: FeatureTriggerInfo,
    groups: FeatureTriggerGroup[],
    key: string
  ) {
    setSavingKeys((current) => ({ ...current, [key]: true }));
    setSaveErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });

    try {
      const updatedFeature = await saveFeatureTriggers(feature.feature_id, groups);
      updateFeature(updatedFeature);
      return true;
    } catch (err) {
      setSaveErrors((current) => ({
        ...current,
        [key]:
          err instanceof Error
            ? err.message
            : "Не удалось сохранить изменения",
      }));
      return false;
    } finally {
      setSavingKeys((current) => ({ ...current, [key]: false }));
    }
  }

  async function handleRemoveTrigger(
    feature: FeatureTriggerInfo,
    group: FeatureTriggerGroup,
    trigger: string
  ) {
    const key = actionKey(feature.feature_id, group.action_id);

    await persistFeatureGroups(
      feature,
      buildUpdatedGroups(
        feature,
        group.action_id,
        group.triggers.filter((item) => item !== trigger)
      ),
      key
    );
  }

  async function handleAddTrigger(
    feature: FeatureTriggerInfo,
    group: FeatureTriggerGroup
  ) {
    const key = actionKey(feature.feature_id, group.action_id);
    const newTrigger = (newTriggerValues[key] ?? "").trim().toLowerCase();

    if (!newTrigger) {
      return;
    }

    const saved = await persistFeatureGroups(
      feature,
      buildUpdatedGroups(feature, group.action_id, [...group.triggers, newTrigger]),
      key
    );

    if (saved) {
      setNewTriggerValues((current) => ({ ...current, [key]: "" }));
    }
  }

  async function handleResetGroup(
    feature: FeatureTriggerInfo,
    group: FeatureTriggerGroup
  ) {
    const defaultGroup = getDefaultGroup(feature.feature_id, group.action_id);

    if (!defaultGroup) {
      return;
    }

    await persistFeatureGroups(
      feature,
      buildUpdatedGroups(feature, group.action_id, defaultGroup.triggers),
      actionKey(feature.feature_id, group.action_id)
    );
  }

  async function handleResetFeature(feature: FeatureTriggerInfo) {
    const defaultGroups = defaultsByFeatureId.get(feature.feature_id);

    if (!defaultGroups) {
      return;
    }

    await persistFeatureGroups(
      feature,
      Array.from(defaultGroups.values()).map((group) => ({
        ...group,
        triggers: normalizeTriggers(group.triggers),
      })),
      feature.feature_id
    );
  }

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal-shell" onClick={handlePanelClick}>
        <aside className="settings-sidebar">
          <div className="settings-brand">
            <span>AI SYSTEM</span>
            <strong>CONTROL PANEL</strong>
          </div>

          <nav className="settings-nav" aria-label="Разделы настроек">
            {SETTINGS_SECTIONS.map((section, index) => (
              <button
                className={[
                  "settings-nav-item",
                  activeSection === section.id ? "is-active" : "",
                  section.disabled ? "is-disabled" : "",
                ].join(" ")}
                type="button"
                key={section.id}
                disabled={section.disabled}
                onClick={() => setActiveSection(section.id)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{section.label}</strong>
              </button>
            ))}
          </nav>

          <div className="settings-sidebar-status">
            <span>LOCAL API</span>
            <strong>{error ? "OFFLINE" : "ONLINE"}</strong>
          </div>
        </aside>

        <section className="settings-content-panel">
          <button
            className="settings-modal-close"
            type="button"
            onClick={onClose}
            aria-label="Закрыть настройки"
          >
            ×
          </button>

          <header className="settings-content-header">
            <div>
              <span className="settings-modal-kicker">LOCAL COMMANDS</span>
              <h2>
                {activeSection === "triggers"
                  ? "Триггеры функций"
                  : "Раздел недоступен"}
              </h2>
            </div>

            <div className="settings-panel-meta">
              <span>MODE</span>
              <strong>EDIT</strong>
            </div>
          </header>

          <div className="settings-tech-separator" />

          <div className="settings-modal-content">
            {isLoading && (
              <div className="settings-loading">Загрузка триггеров...</div>
            )}

            {error && (
              <div className="settings-error">
                <strong>Assistant backend недоступен</strong>
                <span>{error}</span>
              </div>
            )}

            {!isLoading && !error && activeSection === "triggers" && (
              <div className="settings-feature-list">
                {defaultsError && (
                  <div className="settings-warning">
                    <strong>RESET DISABLED</strong>
                    <span>{defaultsError}</span>
                  </div>
                )}

                {features.map((feature) => (
                  <article
                    className="settings-feature-card"
                    key={feature.feature_id}
                  >
                    <div className="settings-feature-top">
                      <div>
                        <h4>{feature.display_name}</h4>
                        <span>{feature.feature_id}</span>
                      </div>

                      <div className="settings-feature-actions">
                        <strong>{feature.plan}</strong>
                        <button
                          type="button"
                          className="settings-expand-button"
                          onClick={() => toggleFeature(feature.feature_id)}
                        >
                          {expandedFeatures[feature.feature_id]
                            ? "Свернуть"
                            : "Развернуть"}
                        </button>
                        <button
                          type="button"
                          disabled={
                            savingKeys[feature.feature_id] ||
                            !defaultsByFeatureId.has(feature.feature_id)
                          }
                          onClick={() => handleResetFeature(feature)}
                        >
                          Сбросить всю функцию
                        </button>
                      </div>
                    </div>

                    <div className="settings-feature-divider" />

                    {expandedFeatures[feature.feature_id] && (
                      <div className="settings-action-group-list">
                        {feature.trigger_groups.map((group) => {
                        const key = actionKey(feature.feature_id, group.action_id);
                        const isSaving =
                          savingKeys[key] || savingKeys[feature.feature_id];
                        const isEditable = isEditableAction(
                          feature.feature_id,
                          group.action_id
                        );

                        return (
                          <section
                            className="settings-action-group"
                            key={group.action_id}
                          >
                            <div className="settings-action-group-header">
                              <div>
                                <h5>{group.display_name}</h5>
                                <span>{group.action_id}</span>
                              </div>

                              {group.action_id === LEGACY_ACTION_ID && (
                                <strong>LEGACY</strong>
                              )}
                            </div>

                            <div className="settings-trigger-list">
                              {group.triggers.length > 0 ? (
                                group.triggers.map((trigger, index) => (
                                  <span
                                    className="settings-trigger-chip"
                                    key={`${trigger}-${index}`}
                                  >
                                    <span>{trigger}</span>
                                    <button
                                      type="button"
                                      aria-label={`Удалить триггер ${trigger}`}
                                      disabled={isSaving || !isEditable}
                                      onClick={() =>
                                        handleRemoveTrigger(
                                          feature,
                                          group,
                                          trigger
                                        )
                                      }
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))
                              ) : (
                                <p className="settings-empty-triggers">
                                  Триггеры не заданы
                                </p>
                              )}
                            </div>

                            {saveErrors[key] && (
                              <div className="settings-inline-error">
                                {saveErrors[key]}
                              </div>
                            )}

                            <div className="settings-trigger-controls">
                              <input
                                type="text"
                                placeholder="Новый триггер"
                                value={newTriggerValues[key] ?? ""}
                                disabled={isSaving || !isEditable}
                                onChange={(event) =>
                                  setNewTriggerValues((current) => ({
                                    ...current,
                                    [key]: event.target.value,
                                  }))
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    void handleAddTrigger(feature, group);
                                  }
                                }}
                              />

                              <button
                                type="button"
                                disabled={
                                  isSaving ||
                                  !isEditable ||
                                  !(newTriggerValues[key] ?? "").trim()
                                }
                                onClick={() => handleAddTrigger(feature, group)}
                              >
                                + добавить
                              </button>

                              <button
                                type="button"
                                disabled={isSaving || !isEditable}
                                onClick={() => handleResetGroup(feature, group)}
                              >
                                Сбросить
                              </button>

                              {isSaving && (
                                <span className="settings-saving-label">
                                  SAVING...
                                </span>
                              )}
                            </div>
                          </section>
                        );
                        })}
                      </div>
                    )}

                    {saveErrors[feature.feature_id] && (
                      <div className="settings-inline-error">
                        {saveErrors[feature.feature_id]}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
