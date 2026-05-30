import { useEffect, useMemo, useState, type MouseEvent } from "react";

import {
  fetchFeatureTriggerDefaults,
  fetchFeatureTriggers,
  saveFeatureTriggers,
  type FeatureTriggerDefaultsInfo,
  type FeatureTriggerGroup,
  type FeatureTriggerInfo,
} from "../services/featureTriggers";
import {
  addAppLauncherAlias,
  cleanupAppLauncherApps,
  deleteAppLauncherAlias,
  deleteAppLauncherApp,
  fetchAppLauncherApps,
  saveAppLauncherApp,
  type AppLauncherTarget,
} from "../services/appLauncherApps";

import "./SettingsModal.css";

type Props = {
  onClose: () => void;
  initialSection?: string;
  initialAppAlias?: string;
  initialAppRequestId?: number;
};

type AppLaunchType = "exe" | "shortcut" | "steam" | "system";

type SettingsSection = {
  id: string;
  label: string;
  disabled?: boolean;
};

const LEGACY_ACTION_ID = "__legacy__";

const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "apps", label: "Приложения" },
  { id: "triggers", label: "Триггеры" },
  { id: "voice", label: "Голос", disabled: true },
  { id: "interface", label: "Интерфейс", disabled: true },
  { id: "neural", label: "Нейросеть", disabled: true },
  { id: "account", label: "Аккаунт", disabled: true },
  { id: "system", label: "Система", disabled: true },
];

const emptyAppForm: AppLauncherTarget = {
  target_id: "",
  name: "",
  type: "exe",
  source: "manual",
  launch_uri: "",
  path: "",
  appid: "",
  spoken_name: "",
  aliases: [],
};

const APP_TYPE_HELP: Record<AppLaunchType, string> = {
  exe: "Обычная программа или игра. Выберите файл .exe, который запускает приложение.",
  shortcut:
    "Ярлык Windows. Лучше выбирать, если игра запускается через ярлык на рабочем столе или в меню Пуск.",
  steam:
    "Игра Steam. Укажите Steam AppID. Игры Steam лучше запускать через Steam, а не напрямую через .exe.",
  system:
    "Системная команда Windows. Например explorer.exe, notepad.exe, calc.exe.",
};

export default function SettingsModal({
  onClose,
  initialSection = "triggers",
  initialAppAlias = "",
  initialAppRequestId = 0,
}: Props) {
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
  const [activeSection, setActiveSection] = useState(initialSection);
  const [apps, setApps] = useState<AppLauncherTarget[]>([]);
  const [appsError, setAppsError] = useState("");
  const [appSaveError, setAppSaveError] = useState("");
  const [expandedApps, setExpandedApps] = useState<Record<string, boolean>>({});
  const [newAliasValues, setNewAliasValues] = useState<Record<string, string>>({});
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [appForm, setAppForm] = useState<AppLauncherTarget>({
    ...emptyAppForm,
    aliases: initialAppAlias ? [initialAppAlias] : [],
  });

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

  useEffect(() => {
    setActiveSection(initialSection);

    if (initialSection === "apps" && initialAppAlias) {
      setEditingAppId("__new__");
      setAppForm({
        ...emptyAppForm,
        aliases: [initialAppAlias],
      });
    }
  }, [initialSection, initialAppAlias, initialAppRequestId]);

  useEffect(() => {
    let mounted = true;

    async function loadApps() {
      try {
        const loadedApps = await fetchAppLauncherApps();

        if (mounted) {
          setApps(loadedApps);
          setAppsError("");
        }
      } catch (err) {
        if (mounted) {
          setAppsError(err instanceof Error ? err.message : "Failed to load apps");
        }
      }
    }

    void loadApps();

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

  function toggleApp(targetId: string) {
    setExpandedApps((current) => ({
      ...current,
      [targetId]: !current[targetId],
    }));
  }

  function beginCreateApp(alias = "") {
    setEditingAppId("__new__");
    setAppSaveError("");
    setAppForm({
      ...emptyAppForm,
      aliases: alias ? [alias] : [],
    });
  }

  function beginEditApp(app: AppLauncherTarget) {
    setEditingAppId(app.target_id);
    setAppSaveError("");
    setExpandedApps((current) => ({ ...current, [app.target_id]: true }));
    setAppForm({ ...app, aliases: [...app.aliases] });
  }

  function cancelEditApp() {
    setEditingAppId(null);
    setAppSaveError("");
    setAppForm({ ...emptyAppForm, aliases: [] });
  }

  async function handleSaveApp() {
    const aliases = normalizeAppAliases(appForm.aliases);

    try {
      setAppSaveError("");
      const savedApps = await saveAppLauncherApp({
        target_id: appForm.target_id,
        name: appForm.name.trim(),
        type: appForm.type,
        source: "manual",
        path:
          appForm.type === "exe" ||
          appForm.type === "shortcut" ||
          appForm.type === "system"
            ? appForm.path?.trim() ?? ""
            : "",
        appid: appForm.type === "steam" ? appForm.appid?.trim() ?? "" : "",
        spoken_name: appForm.spoken_name?.trim() ?? "",
        aliases,
      });
      setApps(savedApps);
      cancelEditApp();
    } catch (err) {
      setAppSaveError(
        err instanceof Error ? err.message : "Не удалось сохранить приложение"
      );
    }
  }

  async function handleDeleteApp(targetId: string) {
    setApps(await deleteAppLauncherApp(targetId));
  }

  async function handleCleanupApps() {
    try {
      setApps(await cleanupAppLauncherApps());
      setAppsError("");
    } catch (err) {
      setAppsError(
        err instanceof Error ? err.message : "Не удалось очистить дубли"
      );
    }
  }

  async function handleAddAlias(targetId: string) {
    const alias = (newAliasValues[targetId] ?? "").trim();

    if (!alias) {
      return;
    }

    setApps(await addAppLauncherAlias(alias, targetId));
    setNewAliasValues((current) => ({ ...current, [targetId]: "" }));
  }

  async function handleDeleteAlias(alias: string) {
    setApps(await deleteAppLauncherAlias(alias));
  }

  function updateAppForm(field: keyof AppLauncherTarget, value: string) {
    setAppForm((current) => ({ ...current, [field]: value }));
  }

  function updateAppFormAliases(value: string) {
    setAppForm((current) => ({
      ...current,
      aliases: value.split("\n"),
    }));
  }

  function normalizeAppAliases(aliases: string[]) {
    return Array.from(
      new Set(aliases.map((alias) => alias.trim().toLowerCase()).filter(Boolean))
    );
  }

  function getAppType(value: string): AppLaunchType {
    return value === "shortcut" || value === "steam" || value === "system"
      ? value
      : "exe";
  }

  function appPrimaryFieldLabel(type: string) {
    if (type === "steam") return "Steam AppID";
    if (type === "system") return "System command";
    return "Path";
  }

  function updateAppType(type: AppLaunchType) {
    setAppForm((current) => ({
      ...current,
      type,
      path: type === "steam" ? "" : current.path,
      appid: type === "steam" ? current.appid : "",
      launch_uri: "",
    }));
  }

  function renderAppForm() {
    const appType = getAppType(appForm.type);
    const showPath = appType === "exe" || appType === "shortcut";
    const showAppId = appType === "steam";
    const showSystem = appType === "system";

    return (
      <>
        {appSaveError && (
          <div className="settings-inline-error">{appSaveError}</div>
        )}

        <div className="settings-app-form">
          <label>
            Название приложения
            <input
              value={appForm.name}
              onChange={(event) => updateAppForm("name", event.target.value)}
            />
          </label>
          <label>
            Произносить как
            <input
              value={appForm.spoken_name ?? ""}
              onChange={(event) =>
                updateAppForm("spoken_name", event.target.value)
              }
            />
          </label>
          <label className="settings-app-form-wide">
            Тип запуска
            <select
              value={appType}
              onChange={(event) => updateAppType(getAppType(event.target.value))}
            >
              <option value="exe">EXE</option>
              <option value="shortcut">SHORTCUT</option>
              <option value="steam">STEAM</option>
              <option value="system">SYSTEM</option>
            </select>
          </label>
          <div className="settings-app-type-help settings-app-form-wide">
            {APP_TYPE_HELP[appType]}
          </div>

          {(showPath || showSystem) && (
            <label className="settings-app-form-wide">
              {appPrimaryFieldLabel(appType)}
              <div className="settings-file-row">
                <input
                  value={appForm.path ?? ""}
                  placeholder={
                    showSystem
                      ? "explorer.exe, notepad.exe, calc.exe"
                      : appType === "exe"
                        ? "C:\\Games\\Game\\Game.exe"
                        : "C:\\Users\\User\\Desktop\\Game.lnk"
                  }
                  onChange={(event) => updateAppForm("path", event.target.value)}
                />
                {showPath && (
                  <button type="button" disabled title="Tauri dialog plugin не подключен">
                    Выбрать файл
                  </button>
                )}
              </div>
              {showPath && (
                <span className="settings-field-hint">
                  Выбор через проводник станет доступен после подключения Tauri dialog plugin.
                </span>
              )}
            </label>
          )}

          {showAppId && (
            <label className="settings-app-form-wide">
              Steam AppID
              <input
                value={appForm.appid ?? ""}
                inputMode="numeric"
                placeholder="Например 228380"
                onChange={(event) => updateAppForm("appid", event.target.value)}
              />
            </label>
          )}

          {showAppId && (
            <a
              className="settings-steamdb-link settings-app-form-wide"
              href="https://steamdb.info/apps/"
              target="_blank"
              rel="noreferrer"
            >
              Найти Steam AppID на SteamDB
            </a>
          )}

          <label className="settings-app-form-wide">
            Aliases
            <textarea
              value={appForm.aliases.join("\n")}
              placeholder="По одному alias на строку"
              onChange={(event) => updateAppFormAliases(event.target.value)}
            />
          </label>
        </div>
      </>
    );
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

  function activeSectionTitle() {
    if (activeSection === "triggers") {
      return "Триггеры функций";
    }

    if (activeSection === "apps") {
      return "Приложения";
    }

    return "Раздел недоступен";
  }

  return (
    <div className="settings-modal-overlay">
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

        <section className="settings-content-panel" aria-label={activeSectionTitle()}>
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
                  : activeSection === "apps"
                    ? "Приложения"
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

            {activeSection === "apps" && (
              <div className="settings-feature-list">
                {appsError && (
                  <div className="settings-warning">
                    <strong>APPS ERROR</strong>
                    <span>{appsError}</span>
                  </div>
                )}

                <div className="settings-app-toolbar">
                  <button
                    type="button"
                    className="settings-expand-button"
                    onClick={() => beginCreateApp(initialAppAlias)}
                  >
                    Добавить приложение
                  </button>
                  <button
                    type="button"
                    className="settings-expand-button"
                    onClick={() => void handleCleanupApps()}
                  >
                    Очистить дубли
                  </button>
                </div>

                {editingAppId === "__new__" && (
                  <article className="settings-feature-card">
                    <div className="settings-feature-top">
                      <div>
                        <h4>Новое приложение</h4>
                        <span>Выберите тип запуска и заполните нужные поля</span>
                      </div>
                    </div>

                    {renderAppForm()}

                    <div className="settings-trigger-controls">
                      <button type="button" onClick={() => void handleSaveApp()}>
                        Сохранить
                      </button>
                      <button type="button" onClick={cancelEditApp}>
                        Отмена
                      </button>
                    </div>
                  </article>
                )}

                {apps.map((app) => (
                  <article className="settings-feature-card" key={app.target_id}>
                    <div className="settings-feature-top">
                      <div>
                        <h4>{app.name}</h4>
                        <span>
                          aliases: {app.aliases.length}
                        </span>
                      </div>
                      <div className="settings-feature-actions">
                        <strong>{app.type}</strong>
                        <strong>{app.source || app.type}</strong>
                        <button
                          type="button"
                          className="settings-expand-button"
                          onClick={() => toggleApp(app.target_id)}
                        >
                          {expandedApps[app.target_id] ? "Свернуть" : "Развернуть"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteApp(app.target_id)}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>

                    {expandedApps[app.target_id] && (
                      <>
                        <div className="settings-feature-divider" />
                        <div className="settings-app-meta">
                          <span>{app.spoken_name || "Произношение не задано"}</span>
                          <span>{app.path || app.launch_uri || app.appid || ""}</span>
                        </div>
                        <div className="settings-trigger-list">
                          {app.aliases.map((alias) => (
                            <span className="settings-trigger-chip" key={alias}>
                              <span>{alias}</span>
                              <button
                                type="button"
                                onClick={() => void handleDeleteAlias(alias)}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        {editingAppId === app.target_id ? (
                          <>
                            {renderAppForm()}
                            <div className="settings-trigger-controls">
                              <button
                                type="button"
                                onClick={() => void handleSaveApp()}
                              >
                                Сохранить
                              </button>
                              <button type="button" onClick={cancelEditApp}>
                                Отмена
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="settings-trigger-controls">
                            <input
                              value={newAliasValues[app.target_id] ?? ""}
                              placeholder="Новый alias"
                              onChange={(event) =>
                                setNewAliasValues((current) => ({
                                  ...current,
                                  [app.target_id]: event.target.value,
                                }))
                              }
                            />
                            <button
                              type="button"
                              onClick={() => void handleAddAlias(app.target_id)}
                            >
                              Добавить alias
                            </button>
                            <button type="button" onClick={() => beginEditApp(app)}>
                              Редактировать
                            </button>
                          </div>
                        )}
                      </>
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
