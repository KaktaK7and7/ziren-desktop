import { useEffect, useState } from "react";

import {
  fetchFeatureTriggers,
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("triggers");

  useEffect(() => {
    let mounted = true;

    async function loadFeatureTriggers() {
      try {
        setIsLoading(true);
        setError("");

        const loadedFeatures = await fetchFeatureTriggers();

        if (mounted) {
          setFeatures(loadedFeatures);
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
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadFeatureTriggers();

    return () => {
      mounted = false;
    };
  }, []);

  function handlePanelClick(event: React.MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
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
              <strong>READ ONLY</strong>
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
                        feature.triggers.map((trigger) => (
                          <span className="settings-trigger-chip" key={trigger}>
                            {trigger}
                          </span>
                        ))
                      ) : (
                        <p className="settings-empty-triggers">
                          Триггеры не заданы
                        </p>
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
