import { useEffect, useMemo, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";

import {
  fetchCompanionSettings,
  saveCompanionSettings,
  type CompanionSettings,
} from "../services/companionSettings";
import {
  fetchFeatureTriggers,
  type FeatureTriggerInfo,
} from "../services/featureTriggers";
import { requestOnboardingOpen } from "../services/onboarding";
import {
  fetchSubscriptionStatus,
  getPricingUrl,
  type SubscriptionStatus,
} from "../services/subscription";
import "./ControlSettingsModal.css";


type Props = {
  onClose: () => void;
  onOpenClassicSettings: () => void;
};


export default function ControlSettingsModal({
  onClose,
  onOpenClassicSettings,
}: Props) {
  const [settings, setSettings] = useState<CompanionSettings | null>(null);
  const [features, setFeatures] = useState<FeatureTriggerInfo[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([
      fetchCompanionSettings(),
      fetchFeatureTriggers(),
      fetchSubscriptionStatus().catch(() => null),
    ])
      .then(([loadedSettings, loadedFeatures, loadedSubscription]) => {
        if (!active) return;
        setSettings(loadedSettings);
        setFeatures(loadedFeatures.filter((feature) => feature.feature_id !== "system.test"));
        setSubscription(loadedSubscription);
        setError("");
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Не удалось загрузить возможности Ziren");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const visibleFeatures = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ru-RU");
    if (!needle) return features;
    return features.filter((feature) =>
      feature.display_name.toLocaleLowerCase("ru-RU").includes(needle)
      || feature.feature_id.toLocaleLowerCase("ru-RU").includes(needle)
      || feature.trigger_groups.some((group) =>
        group.display_name.toLocaleLowerCase("ru-RU").includes(needle)
        || group.triggers.some((trigger) => trigger.toLocaleLowerCase("ru-RU").includes(needle)),
      ),
    );
  }, [features, query]);

  const melissaLocked = Boolean(
    subscription
    && !subscription.beta_override
    && subscription.plan === "free",
  );

  async function updateModes(patch: Partial<CompanionSettings>) {
    if (!settings || saving) return;
    const previous = settings;
    const next = { ...settings, ...patch };

    if (!next.melissa_command_mode_enabled && !next.snake_command_mode_enabled) {
      setError("Оставь включённым хотя бы один режим команд: Мелиссу или Змею.");
      return;
    }

    if (patch.melissa_command_mode_enabled && melissaLocked) {
      setError("Мелисса доступна на тарифах Plus и Pro. Змея остаётся бесплатной.");
      return;
    }

    setSettings(next);
    setSaving(true);
    setError("");
    try {
      setSettings(await saveCompanionSettings(next));
    } catch (reason) {
      setSettings(previous);
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить режим команд");
    } finally {
      setSaving(false);
    }
  }

  function reopenOnboarding() {
    onClose();
    window.setTimeout(() => requestOnboardingOpen(), 0);
  }

  return (
    <div className="control-settings-overlay" onMouseDown={onClose}>
      <section className="control-settings-shell" onMouseDown={(event) => event.stopPropagation()}>
        <header className="control-settings-header">
          <div>
            <span>ZIREN CONTROL</span>
            <h2>Функции и режимы</h2>
            <p>Один каталог действий для локальной Змеи и умной Мелиссы.</p>
          </div>
          <button type="button" className="control-settings-close" onClick={onClose}>×</button>
        </header>

        {error && <div className="control-settings-error">{error}</div>}
        {loading && <div className="control-settings-loading">Загрузка возможностей…</div>}

        {!loading && settings && (
          <>
            {subscription && (
              <section className="control-subscription-card">
                <div className="control-subscription-main">
                  <span className="control-subscription-kicker">ТВОЙ ТАРИФ</span>
                  <div className="control-subscription-title">
                    <strong>{subscription.plan_name || subscription.plan.toUpperCase()}</strong>
                    {subscription.beta_override && <b>BETA ACCESS</b>}
                  </div>
                  <p>
                    {subscription.beta_override
                      ? "Платёжный режим ещё не включён. Мелисса открыта для тестирования, а расход AI уже учитывается."
                      : subscription.ai_enabled
                        ? "Облачные функции Мелиссы активны."
                        : "Локальная Змея активна. Для облачной Мелиссы нужен Plus или Pro."}
                  </p>
                </div>

                {subscription.plan !== "free" && (
                  <div className="control-subscription-usage">
                    <div>
                      <span>AI-ресурс</span>
                      <strong>{Math.max(0, Math.min(100, subscription.ai_usage_percent || 0))}%</strong>
                    </div>
                    <i>
                      <b style={{ width: `${Math.max(0, Math.min(100, subscription.ai_usage_percent || 0))}%` }} />
                    </i>
                    <small>Локальные команды Змеи ресурс не расходуют.</small>
                  </div>
                )}

                <button type="button" onClick={() => void openUrl(getPricingUrl())}>
                  Тарифы
                </button>
              </section>
            )}

            <div className="control-mode-grid">
              <article className={`${settings.melissa_command_mode_enabled ? "is-enabled" : ""}${melissaLocked ? " is-locked" : ""}`}>
                <div>
                  <span className="control-mode-tag">SMART / PLUS + PRO</span>
                  <h3>Мелисса</h3>
                  <p>
                    Понимает команду естественным языком. Нейросеть выбирает только разрешённый
                    action ID, а действие проверяет и выполняет локальный Core.
                  </p>
                  {melissaLocked && <small className="control-mode-lock">Нужен тариф Plus или Pro</small>}
                </div>
                <label className="control-mode-switch">
                  <input
                    type="checkbox"
                    checked={settings.melissa_command_mode_enabled && !melissaLocked}
                    disabled={saving || melissaLocked}
                    onChange={(event) => void updateModes({ melissa_command_mode_enabled: event.target.checked })}
                  />
                  <span />
                </label>
              </article>

              <article className={settings.snake_command_mode_enabled ? "is-enabled" : ""}>
                <div>
                  <span className="control-mode-tag">LOCAL / FREE</span>
                  <h3>Змея</h3>
                  <p>
                    Никакой нейросети. Только локальные trigger-группы — стандартные и добавленные
                    пользователем в редакторе триггеров.
                  </p>
                </div>
                <label className="control-mode-switch">
                  <input
                    type="checkbox"
                    checked={settings.snake_command_mode_enabled}
                    disabled={saving}
                    onChange={(event) => void updateModes({ snake_command_mode_enabled: event.target.checked })}
                  />
                  <span />
                </label>
              </article>
            </div>

            <div className="control-settings-toolbar">
              <div>
                <strong>Что умеет Ziren</strong>
                <span>{features.length} модулей · {features.reduce((sum, item) => sum + item.trigger_groups.length, 0)} действий</span>
              </div>
              <input
                value={query}
                placeholder="Найти функцию или команду"
                onChange={(event) => setQuery(event.target.value)}
              />
              <button type="button" onClick={reopenOnboarding}>
                Повторить настройку
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenClassicSettings();
                }}
              >
                Редактор триггеров
              </button>
            </div>

            <div className="control-capability-list">
              {visibleFeatures.map((feature) => (
                <article className="control-capability-card" key={feature.feature_id}>
                  <div className="control-capability-head">
                    <div>
                      <h4>{feature.display_name}</h4>
                      <span>{feature.feature_id}</span>
                    </div>
                    <strong>{feature.plan.toUpperCase()}</strong>
                  </div>

                  <div className="control-capability-actions">
                    {feature.trigger_groups.map((group) => (
                      <div key={group.action_id}>
                        <div className="control-capability-action-head">
                          <strong>{group.display_name}</strong>
                          <span>{group.action_id}</span>
                          <div>
                            {group.melissa_semantic && <b>МЕЛИССА</b>}
                            {group.snake_triggers !== false && <b>ЗМЕЯ</b>}
                          </div>
                        </div>
                        {group.argument_hint && <p>{group.argument_hint}</p>}
                        <div className="control-trigger-preview">
                          {group.triggers.slice(0, 5).map((trigger) => (
                            <span key={trigger}>{trigger}</span>
                          ))}
                          {group.triggers.length > 5 && <span>+{group.triggers.length - 5}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}

              {!visibleFeatures.length && (
                <div className="control-settings-empty">Ничего не найдено.</div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
