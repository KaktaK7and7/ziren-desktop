import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import type {
  ScreenGuidance,
  ScreenGuidanceAction,
} from "../services/screenGuidance";


type OverlayMode = "listening" | "capture" | "guidance";

const MODE_LABELS: Record<ScreenGuidance["mode"], string> = {
  explain: "РАЗБОР ЭКРАНА",
  translate: "ПЕРЕВОД",
  guide: "ПОМОЩЬ В ПРОГРАММЕ",
  annotate: "КАРТА ЭКРАНА",
};


export default function ScreenOverlay() {
  const [mode, setMode] = useState<OverlayMode>("listening");
  const [guidance, setGuidance] = useState<ScreenGuidance | null>(null);
  const [workingAction, setWorkingAction] = useState<string>("");

  useEffect(() => {
    document.documentElement.classList.add("screen-overlay-document");
    document.body.classList.add("screen-overlay-body");

    const unlistenMode = listen<{ mode?: string }>(
      "screen-overlay-mode",
      (event) => {
        const nextMode = event.payload?.mode;
        if (nextMode === "capture" || nextMode === "listening") {
          setMode(nextMode);
          setWorkingAction("");
        }
      },
    );
    const unlistenGuidance = listen<ScreenGuidance>(
      "screen-guidance-show",
      (event) => {
        setGuidance(event.payload);
        setMode("guidance");
        setWorkingAction("");
      },
    );

    return () => {
      document.documentElement.classList.remove("screen-overlay-document");
      document.body.classList.remove("screen-overlay-body");
      void unlistenMode.then((dispose) => dispose());
      void unlistenGuidance.then((dispose) => dispose());
    };
  }, []);

  useEffect(() => {
    if (mode !== "guidance" || !guidance) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        void sendAction("dismiss");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, guidance, workingAction]);

  async function sendAction(action: ScreenGuidanceAction["action"]) {
    if (!guidance || workingAction) return;

    setWorkingAction(action);
    try {
      await invoke("dispatch_screen_guidance_action", {
        payload: {
          analysisId: guidance.id,
          action,
        } satisfies ScreenGuidanceAction,
      });
    } catch (error) {
      console.error("Failed to dispatch screen guidance action:", error);
      setWorkingAction("");
    }
  }

  if (mode === "capture") {
    return (
      <div className="screen-overlay screen-overlay--capture" aria-live="polite">
        <div className="screen-overlay__edge" />
        <div className="screen-capture-indicator">
          <span className="screen-capture-indicator__eye">◉</span>
          <div>
            <strong>Мелисса получила разовый снимок</strong>
            <small>Это не постоянное наблюдение за экраном</small>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "guidance" && guidance) {
    return (
      <div className="screen-overlay screen-overlay--guidance">
        <div className="screen-guidance-privacy">
          <span>●</span>
          Разовый снимок обработан · постоянный просмотр выключен
        </div>

        <section className="screen-guidance-panel" aria-label="Подсказка Мелиссы">
          <header>
            <div>
              <span>ZIREN // SCREEN COPILOT</span>
              <strong>{MODE_LABELS[guidance.mode]}</strong>
            </div>
            <button
              type="button"
              aria-label="Закрыть подсказку"
              onClick={() => void sendAction("dismiss")}
            >
              ×
            </button>
          </header>

          <p>{guidance.answer}</p>

          {guidance.annotations.length > 0 && (
            <ol>
              {guidance.annotations.map((annotation, index) => (
                <li key={annotation.id}>
                  <span>{annotation.step || index + 1}</span>
                  {annotation.label}
                </li>
              ))}
            </ol>
          )}

          {guidance.action.requested
            && guidance.action.risk === "blocked"
            && guidance.action.reason && (
            <div className="screen-guidance-warning">
              Автонажатие недоступно: {guidance.action.reason}
            </div>
          )}

          <footer>
            {guidance.canvas_available && (
              <button
                className="screen-guidance-button is-secondary"
                type="button"
                disabled={Boolean(workingAction)}
                onClick={() => void sendAction("canvas")}
              >
                {workingAction === "canvas" ? "Сохраняю…" : "Сохранить в Холст"}
              </button>
            )}
          </footer>
        </section>
      </div>
    );
  }

  return (
    <div className="screen-overlay" aria-hidden="true">
      <div className="screen-overlay__edge" />
    </div>
  );
}
