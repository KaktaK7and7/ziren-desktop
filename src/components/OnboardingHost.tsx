import { useEffect, useMemo, useState } from "react";

import { getAssistantStatus } from "../services/assistantApi";
import {
  fetchCompanionSettings,
  saveCompanionSettings,
  type CompanionSettings,
} from "../services/companionSettings";
import { ONBOARDING_OPEN_EVENT } from "../services/onboarding";
import { getCurrentUser } from "../services/session";
import {
  fetchSubscriptionStatus,
  type SubscriptionStatus,
} from "../services/subscription";
import "./OnboardingHost.css";


type CheckState = "idle" | "checking" | "ok" | "error";

const LAST_STEP = 4;

function onboardingKey(userId: number | string) {
  return `ziren_onboarding_v1_${userId}`;
}

async function measureMicrophoneSignal() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Проверка микрофона недоступна в этом WebView.");
  }
  if (!window.AudioContext) {
    throw new Error("WebAudio недоступен. Не удалось проверить живой сигнал микрофона.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const context = new window.AudioContext();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);

  const samples = new Uint8Array(analyser.fftSize);
  let peak = 0;

  try {
    for (let pass = 0; pass < 12; pass += 1) {
      analyser.getByteTimeDomainData(samples);
      for (const sample of samples) {
        peak = Math.max(peak, Math.abs(sample - 128));
      }
      await new Promise((resolve) => window.setTimeout(resolve, 90));
    }
  } finally {
    stream.getTracks().forEach((track) => track.stop());
    await context.close().catch(() => undefined);
  }

  if (peak < 2) {
    throw new Error("Микрофон доступен, но Ziren не видит аудиосигнал. Скажи что-нибудь и повтори проверку.");
  }

  return peak;
}

export default function OnboardingHost() {
  const user = getCurrentUser();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [settings, setSettings] = useState<CompanionSettings | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [coreState, setCoreState] = useState<CheckState>("idle");
  const [micState, setMicState] = useState<CheckState>("idle");
  const [coreMessage, setCoreMessage] = useState("");
  const [micMessage, setMicMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) return;

    let active = true;

    async function prepare(force: boolean) {
      if (!user?.id) return;
      if (!force && localStorage.getItem(onboardingKey(user.id)) === "done") return;

      setStep(0);
      setCoreState("idle");
      setMicState("idle");
      setCoreMessage("");
      setMicMessage("");
      setError("");
      setSaving(false);
      setSettings(null);
      setSubscription(null);
      setVisible(true);

      try {
        const [loadedSettings, loadedSubscription] = await Promise.all([
          fetchCompanionSettings(),
          fetchSubscriptionStatus().catch(() => null),
        ]);
        if (!active) return;
        setSettings(loadedSettings);
        setSubscription(loadedSubscription);
      } catch (reason) {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Не удалось подготовить первый запуск Ziren");
      }
    }

    const reopen = () => {
      void prepare(true);
    };

    window.addEventListener(ONBOARDING_OPEN_EVENT, reopen);
    void prepare(false);

    return () => {
      active = false;
      window.removeEventListener(ONBOARDING_OPEN_EVENT, reopen);
    };
  }, [user?.id]);

  const melissaLocked = Boolean(
    subscription
    && !subscription.beta_override
    && subscription.plan === "free",
  );

  const modeDescription = useMemo(() => {
    if (!settings) return "";
    if (settings.melissa_command_mode_enabled && settings.snake_command_mode_enabled) {
      return "Мелисса и Змея включены одновременно.";
    }
    if (settings.melissa_command_mode_enabled) return "Включена только умная Мелисса.";
    return "Включена локальная Змея.";
  }, [settings]);

  const canAdvance = useMemo(() => {
    if (step === 0) return coreState === "ok" && micState === "ok";
    if (step === 1) return Boolean(settings) && !saving;
    return true;
  }, [coreState, micState, saving, settings, step]);

  async function checkCore() {
    setCoreState("checking");
    setCoreMessage("");
    try {
      const status = await getAssistantStatus();
      if (!status.running) throw new Error("Core отвечает, но не сообщает состояние running.");
      setCoreState("ok");
      setCoreMessage(status.listening ? "Core запущен, прослушивание включено." : "Core запущен. Прослушивание сейчас выключено.");
    } catch (reason) {
      setCoreState("error");
      setCoreMessage(reason instanceof Error ? reason.message : "Core не отвечает.");
    }
  }

  async function checkMicrophone() {
    setMicState("checking");
    setMicMessage("Скажи несколько слов обычным голосом…");
    try {
      const peak = await measureMicrophoneSignal();
      setMicState("ok");
      setMicMessage(`Микрофон работает. Сигнал обнаружен (${peak}).`);
    } catch (reason) {
      setMicState("error");
      setMicMessage(reason instanceof Error ? reason.message : "Не удалось проверить микрофон.");
    }
  }

  async function setModes(patch: Partial<CompanionSettings>) {
    if (!settings || saving) return;
    if (patch.melissa_command_mode_enabled && melissaLocked) {
      setError("На Free Мелисса недоступна. Локальная Змея остаётся бесплатной.");
      return;
    }

    const previous = settings;
    const next = { ...settings, ...patch };
    if (!next.melissa_command_mode_enabled && !next.snake_command_mode_enabled) {
      setError("Нужно оставить включённым хотя бы один режим команд.");
      return;
    }

    setSettings(next);
    setSaving(true);
    setError("");
    try {
      setSettings(await saveCompanionSettings(next));
    } catch (reason) {
      setSettings(previous);
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить режимы.");
    } finally {
      setSaving(false);
    }
  }

  function finish() {
    if (user?.id) localStorage.setItem(onboardingKey(user.id), "done");
    setVisible(false);
  }

  function goNext() {
    if (!canAdvance) return;
    setStep((value) => Math.min(LAST_STEP, value + 1));
  }

  if (!visible) return null;

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label="Первый запуск Ziren">
      <section className="onboarding-shell">
        <header className="onboarding-header">
          <div>
            <span>ZIREN / FIRST RUN</span>
            <h2>Настроим ассистента</h2>
          </div>
          <div className="onboarding-progress" aria-label={`Шаг ${step + 1} из ${LAST_STEP + 1}`}>
            {Array.from({ length: LAST_STEP + 1 }, (_, index) => (
              <i key={index} className={index <= step ? "is-active" : ""} />
            ))}
          </div>
        </header>

        {error && <div className="onboarding-error">{error}</div>}

        <main className="onboarding-body">
          {step === 0 && (
            <div className="onboarding-step">
              <span className="onboarding-kicker">01 / СВЯЗЬ</span>
              <h3>Проверим Core и микрофон</h3>
              <p>Это реальная проверка, а не декоративная галочка. Ziren должен видеть Core и живой аудиосигнал.</p>
              <div className="onboarding-check-grid">
                <article className={`state-${coreState}`}>
                  <strong>Assistant Core</strong>
                  <p>{coreMessage || "Проверим локальный API и состояние прослушивания."}</p>
                  <button type="button" disabled={coreState === "checking"} onClick={() => void checkCore()}>
                    {coreState === "checking" ? "Проверяю…" : "Проверить Core"}
                  </button>
                </article>
                <article className={`state-${micState}`}>
                  <strong>Микрофон</strong>
                  <p>{micMessage || "Windows может запросить доступ к микрофону."}</p>
                  <button type="button" disabled={micState === "checking"} onClick={() => void checkMicrophone()}>
                    {micState === "checking" ? "Слушаю…" : "Проверить микрофон"}
                  </button>
                </article>
              </div>
              {!canAdvance && (
                <p className="onboarding-gate-note">Чтобы продолжить, Core и микрофон должны пройти проверку. Если сейчас неудобно — нажми «Позже».</p>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="onboarding-step">
              <span className="onboarding-kicker">02 / РЕЖИМЫ</span>
              <h3>Как будут выполняться команды</h3>
              <p>{modeDescription || "Загружаю текущие режимы…"}</p>
              <div className="onboarding-mode-grid">
                <button
                  type="button"
                  className={settings?.snake_command_mode_enabled ? "is-selected" : ""}
                  disabled={!settings || saving}
                  onClick={() => void setModes({ snake_command_mode_enabled: !settings?.snake_command_mode_enabled })}
                >
                  <b>Змея</b>
                  <span>FREE · локальные триггеры · без облачной нейросети</span>
                </button>
                <button
                  type="button"
                  className={settings?.melissa_command_mode_enabled && !melissaLocked ? "is-selected" : ""}
                  disabled={!settings || saving || melissaLocked}
                  onClick={() => void setModes({ melissa_command_mode_enabled: !settings?.melissa_command_mode_enabled })}
                >
                  <b>Мелисса</b>
                  <span>{melissaLocked ? "Нужен Plus или Pro" : "SMART · естественный язык · безопасные structured actions"}</span>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="onboarding-step">
              <span className="onboarding-kicker">03 / ПЕРВЫЕ КОМАНДЫ</span>
              <h3>Попробуй сразу после мастера</h3>
              <div className="onboarding-command-list">
                <code>Змея, открой загрузки</code>
                <code>Змея, громкость на тридцать</code>
                <code>{settings?.melissa_command_mode_enabled && !melissaLocked ? "Мелисса, какая температура видеокарты?" : "Змея, сделай скриншот"}</code>
              </div>
              <p>Змея ищет локальные фразы-триггеры. Мелисса сначала выбирает разрешённое действие, а выполняет его локальный Core.</p>
            </div>
          )}

          {step === 3 && (
            <div className="onboarding-step">
              <span className="onboarding-kicker">04 / ПРИВАТНОСТЬ</span>
              <h3>Что видит и отправляет Ziren</h3>
              <ul className="onboarding-privacy-list">
                <li><b>Змея:</b> локальные команды не требуют облачного AI.</li>
                <li><b>Мелисса:</b> облачный AI используется для понимания/диалога согласно тарифу и лимиту AI-ресурса.</li>
                <li><b>Экран:</b> снимок запрашивается только для конкретной команды анализа; постоянное скрытое наблюдение не является режимом по умолчанию.</li>
                <li><b>Опасные действия:</b> выключение, перезагрузка и сон требуют подтверждения.</li>
              </ul>
            </div>
          )}

          {step === 4 && (
            <div className="onboarding-step onboarding-finish">
              <span className="onboarding-kicker">05 / ГОТОВО</span>
              <h3>Ziren готов к первому запуску</h3>
              <p>Полный список действий, примеры фраз, текущий тариф и AI-ресурс находятся в разделе «Функции и режимы».</p>
              <button type="button" className="onboarding-finish-button" onClick={finish}>Начать пользоваться Ziren</button>
            </div>
          )}
        </main>

        <footer className="onboarding-footer">
          <button type="button" className="is-quiet" onClick={() => setVisible(false)}>Позже</button>
          <div>
            {step > 0 && <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))}>Назад</button>}
            {step < LAST_STEP && (
              <button
                type="button"
                className="is-primary"
                disabled={!canAdvance}
                title={!canAdvance && step === 0 ? "Сначала проверь Core и микрофон" : undefined}
                onClick={goNext}
              >
                Дальше
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
