import { useEffect, useMemo, useState, type MouseEvent } from "react";

import {
  fetchFeatureTriggerDefaults,
  fetchFeatureTriggers,
  saveFeatureTriggers,
  type FeatureTriggerDefaultsInfo,
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
  const [savingFeatureIds, setSavingFeatureIds] = useState<
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
        featureDefaults.default_triggers,
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

  async function persistFeatureTriggers(
    feature: FeatureTriggerInfo,
    triggers: string[]
  ) {
    const featureId = feature.feature_id;

    setSavingFeatureIds((current) => ({ ...current, [featureId]: true }));
    setSaveErrors((current) => {
      const next = { ...current };
      delete next[featureId];
      return next;
    });

    try {
      const updatedFeature = await saveFeatureTriggers(
        featureId,
        normalizeTriggers(triggers)
      );

      updateFeature(updatedFeature);
      return true;
    } catch (err) {
      setSaveErrors((current) => ({
        ...current,
        [featureId]:
          err instanceof Error
            ? err.message
            : "Не удалось сохранить изменения",
      }));
      return false;
    } finally {
      setSavingFeatureIds((current) => ({ ...current, [featureId]: false }));
    }
  }

  async function handleRemoveTrigger(feature: FeatureTriggerInfo, trigger: string) {
    await persistFeatureTriggers(
      feature,
      feature.triggers.filter((item) => item !== trigger)
    );
  }

  async function handleAddTrigger(feature: FeatureTriggerInfo) {
    const featureId = feature.feature_id;
    const newTrigger = (newTriggerValues[featureId] ?? "").trim().toLowerCase();

    if (!newTrigger) {
      return;
    }

    const saved = await persistFeatureTriggers(feature, [
      ...feature.triggers,
      newTrigger,
    ]);

    if (saved) {
      setNewTriggerValues((current) => ({ ...current, [featureId]: "" }));
    }
  }

  async function handleResetFeature(feature: FeatureTriggerInfo) {
    const defaultTriggers = defaultsByFeatureId.get(feature.feature_id);

    if (!defaultTriggers) {
      return;
    }

    await persistFeatureTriggers(feature, defaultTriggers);
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

                      <strong>{feature.plan}</strong>
                    </div>

                    <div className="settings-feature-divider" />

                    <div className="settings-trigger-list">
                      {feature.triggers.length > 0 ? (
                        feature.triggers.map((trigger, index) => (
                          <span
                            className="settings-trigger-chip"
                            key={`${trigger}-${index}`}
                          >
                            <span>{trigger}</span>
                            <button
                              type="button"
                              aria-label={`Удалить триггер ${trigger}`}
                              disabled={savingFeatureIds[feature.feature_id]}
                              onClick={() =>
                                handleRemoveTrigger(feature, trigger)
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

                    {saveErrors[feature.feature_id] && (
                      <div className="settings-inline-error">
                        {saveErrors[feature.feature_id]}
                      </div>
                    )}

                    <div className="settings-trigger-controls">
                      <input
                        type="text"
                        placeholder="Новый триггер"
                        value={newTriggerValues[feature.feature_id] ?? ""}
                        disabled={savingFeatureIds[feature.feature_id]}
                        onChange={(event) =>
                          setNewTriggerValues((current) => ({
                            ...current,
                            [feature.feature_id]: event.target.value,
                          }))
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            void handleAddTrigger(feature);
                          }
                        }}
                      />

                      <button
                        type="button"
                        disabled={
                          savingFeatureIds[feature.feature_id] ||
                          !(newTriggerValues[feature.feature_id] ?? "").trim()
                        }
                        onClick={() => handleAddTrigger(feature)}
                      >
                        + добавить
                      </button>

                      <button
                        type="button"
                        disabled={
                          savingFeatureIds[feature.feature_id] ||
                          !defaultsByFeatureId.has(feature.feature_id)
                        }
                        onClick={() => handleResetFeature(feature)}
                      >
                        Сбросить к дефолту
                      </button>

                      {savingFeatureIds[feature.feature_id] && (
                        <span className="settings-saving-label">SAVING...</span>
                      )}
                    </div>
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
