import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import LogoOrb from "../components/LogoOrb";
import LogTerminal from "../components/LogTerminal";
import SettingsButton from "../components/SettingsButton";
import SettingsModal from "../components/SettingsModal";
import ListeningToggle from "../components/ListeningToggle";
import CyberPsychoBackground from "../components/CyberPsychoBackground";
import ProfileModal from "../components/ProfileModal";
import StoryModal from "../components/StoryModal";
import DrawingModal from "../components/DrawingModal";

import {
  getAssistantStatus,
  toggleAssistantListening,
} from "../services/assistantApi";

import {
  fetchAssistantEvents,
  type AssistantEvent,
} from "../services/assistantEvents";

import { getCurrentUser } from "../services/session";
import { fetchAssistantApi } from "../services/localApi";
import {
  dismissScreenGuidance,
  saveScreenToCanvas,
  type ScreenGuidance,
  type ScreenGuidanceAction,
} from "../services/screenGuidance";

type Props = {
  onLogout: () => void;
};

type AssistantApiLog = {
  ts: string;
  level?: string;
  event?: string;
  meta?: Record<string, unknown>;
};

type AssistantUiState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking";

type DrawingNotice = {
  status: "working" | "ready" | "error";
  drawingId?: string;
  title: string;
  message: string;
};

type ScreenNotice = {
  status: "info" | "success" | "error";
  title: string;
  message: string;
};

function formatApiLog(log: AssistantApiLog): string {
  const time = log.ts
    ? new Date(log.ts).toLocaleTimeString()
    : new Date().toLocaleTimeString();

  const level = log.level
    ? log.level.toUpperCase()
    : "INFO";

  const event = log.event ?? "Unknown event";

  const meta =
    log.meta && Object.keys(log.meta).length > 0
      ? ` ${JSON.stringify(log.meta)}`
      : "";

  return `[${time}] [${level}] ${event}${meta}`;
}

export default function MainScreen({
  onLogout,
}: Props) {
  const user = getCurrentUser();

  const username =
    user?.username ?? "Unknown";

  const [guiLogs, setGuiLogs] = useState<
    string[]
  >([]);

  const [assistantLogs, setAssistantLogs] =
    useState<string[]>([]);

  const [isListening, setIsListening] =
    useState(true);

  const [isLoading, setIsLoading] =
    useState(false);

  const [isProfileOpen, setIsProfileOpen] =
    useState(false);

  const [isSettingsOpen, setIsSettingsOpen] =
    useState(false);

  const [isStoryOpen, setIsStoryOpen] =
    useState(false);

  const [isDrawingOpen, setIsDrawingOpen] =
    useState(false);

  const [drawingInitialId, setDrawingInitialId] =
    useState("");

  const [drawingNotice, setDrawingNotice] =
    useState<DrawingNotice | null>(null);

  const [unreadDrawingCount, setUnreadDrawingCount] =
    useState(0);

  const [screenNotice, setScreenNotice] =
    useState<ScreenNotice | null>(null);

  const [settingsInitialSection, setSettingsInitialSection] =
    useState("triggers");

  const [settingsInitialAppAlias, setSettingsInitialAppAlias] =
    useState("");

  const [settingsInitialAppRequestId, setSettingsInitialAppRequestId] =
    useState(0);

  const [assistantUiState, setAssistantUiState] =
    useState<AssistantUiState>("idle");

  const [, setIsListeningOverlayActive] =
    useState(false);

  const processedEventIdsRef =
    useRef<Set<string>>(new Set());
  const overlayHideTimeoutRef =
    useRef<number | null>(null);
  const overlayCommandQueueRef =
    useRef<Promise<void>>(Promise.resolve());

  const logs = [
    ...guiLogs,
    ...assistantLogs,
  ].slice(-150);

  function addGuiLog(log: string) {
    const time =
      new Date().toLocaleTimeString();

    setGuiLogs((prev) => [
      ...prev.slice(-30),
      `[${time}] ${log}`,
    ]);
  }

  function queueOverlayCommand(
    command: string,
    args?: Record<string, unknown>,
  ) {
    const next = overlayCommandQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        await invoke(command, args);
      });
    overlayCommandQueueRef.current = next;
    return next;
  }

  async function showScreenOverlay() {
    if (overlayHideTimeoutRef.current !== null) {
      window.clearTimeout(overlayHideTimeoutRef.current);
      overlayHideTimeoutRef.current = null;
    }

    setIsListeningOverlayActive(true);

    try {
      await queueOverlayCommand("show_listening_overlay");
    } catch (error) {
      console.error("Failed to show screen overlay:", error);
    }
  }

  async function hideScreenOverlay() {
    if (overlayHideTimeoutRef.current !== null) {
      window.clearTimeout(overlayHideTimeoutRef.current);
      overlayHideTimeoutRef.current = null;
    }

    setIsListeningOverlayActive(false);

    try {
      await queueOverlayCommand("hide_listening_overlay");
    } catch (error) {
      console.error("Failed to hide screen overlay:", error);
    }
  }

  function hideScreenOverlaySoon(delayMs = 320) {
    if (overlayHideTimeoutRef.current !== null) {
      window.clearTimeout(overlayHideTimeoutRef.current);
    }

    overlayHideTimeoutRef.current = window.setTimeout(() => {
      overlayHideTimeoutRef.current = null;
      void hideScreenOverlay();
    }, delayMs);
  }

  async function syncAssistantStatus() {
    const status =
      await getAssistantStatus();

    setIsListening(status.listening);
  }

  useEffect(() => {
    addGuiLog(
      "[GUI] Cyberpsychosis interface initialized"
    );

    addGuiLog(
      "[SYSTEM] Connecting to assistant..."
    );

    async function initAssistantStatus() {
      try {
        const status =
          await getAssistantStatus();

        setIsListening(status.listening);

        addGuiLog(
          "[SYSTEM] Assistant connected"
        );

        if (status.listening) {
          addGuiLog(
            "[VOICE] Listening enabled"
          );
        } else {
          addGuiLog(
            "[VOICE] Listening disabled"
          );
        }
      } catch (error) {
        addGuiLog(
          "[ERROR] Assistant not reachable"
        );

        console.error(error);
      }
    }

    initAssistantStatus();
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const introKey = `ziren_story_intro_seen_${user.id}`;

    if (localStorage.getItem(introKey) === "true") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      localStorage.setItem(introKey, "true");
      setIsStoryOpen(true);
      addGuiLog("[STORY] Unknown memory signal detected");
    }, 900);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;

    async function syncListeningStatus() {
      try {
        const status =
          await getAssistantStatus();

        if (mounted) {
          setIsListening(status.listening);
        }
      } catch (error) {
        console.error(error);
      }
    }

    syncListeningStatus();

    const intervalId =
      window.setInterval(
        syncListeningStatus,
        1500
      );

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    function applyAssistantEvent(event: AssistantEvent) {
      switch (event.type) {
        case "assistant.ready":
          void syncAssistantStatus();
          void hideScreenOverlay();
          setAssistantUiState("idle");
          break;

        case "tts.finished":
          setAssistantUiState("idle");
          break;

        case "listening.enabled":
          setIsListening(true);
          setAssistantUiState("idle");
          break;

        case "listening.disabled":
          setIsListening(false);
          void hideScreenOverlay();
          setAssistantUiState("idle");
          break;

        case "wake_word.detected":
          console.log("[Assistant Event]", event.type, event.payload);
          void showScreenOverlay();
          setAssistantUiState("listening");
          break;

        case "command.received":
          void showScreenOverlay();
          setAssistantUiState("listening");
          break;

        case "ai.followup.started":
          void showScreenOverlay();
          setAssistantUiState("listening");
          break;

        case "speech.recognized":
          hideScreenOverlaySoon();
          setAssistantUiState(
            event.payload.mode === "ai"
              ? "thinking"
              : "idle"
          );
          break;

        case "ai.request.started":
          void hideScreenOverlay();
          setAssistantUiState("thinking");
          break;

        case "screen.capture.requested":
          setScreenNotice({
            status: "info",
            title: "Разовый снимок экрана",
            message: "Мелисса получает только текущий кадр. Постоянный просмотр выключен.",
          });
          void queueOverlayCommand("show_screen_capture_overlay");
          break;

        case "screen.capture.completed":
          setScreenNotice({
            status: "info",
            title: "Снимок готов",
            message: "Изображение отправлено только для текущего ответа и не записано в память.",
          });
          break;

        case "screen.analysis.ready":
          setScreenNotice(null);
          void queueOverlayCommand("show_screen_guidance_overlay", {
            payload: event.payload as unknown as ScreenGuidance,
          });
          break;

        case "screen.capture.failed":
          void hideScreenOverlay();
          setScreenNotice({
            status: "error",
            title: "Снимок не получен",
            message: "Проверь доступ Windows к захвату экрана и попробуй ещё раз.",
          });
          break;

        case "screen.action.completed":
          void hideScreenOverlay();
          setScreenNotice({
            status: "success",
            title: "Нажатие выполнено",
            message:
              typeof event.payload.label === "string"
                ? `Мелисса нажала «${event.payload.label}» по твоей команде.`
                : "Мелисса выполнила одно нажатие по твоей команде.",
          });
          break;

        case "screen.action.failed":
        case "screen.canvas.failed":
          void hideScreenOverlay();
          setScreenNotice({
            status: "error",
            title: "Действие не выполнено",
            message: "Предложение устарело или Windows отклонила действие. Сделай новый снимок.",
          });
          break;

        case "ai.response.received":
          setAssistantUiState("thinking");
          break;

        case "tts.started":
          if (event.payload.source === "command_timeout") {
            void hideScreenOverlay();
          }

          setAssistantUiState("speaking");
          break;

        case "ai.followup.captured":
          hideScreenOverlaySoon();
          setAssistantUiState("thinking");
          break;

        case "ai.followup.timeout":
        case "ai.followup.skipped":
        case "command.timeout":
          void hideScreenOverlay();
          setAssistantUiState("idle");
          break;

        case "command.module.executed":
        case "command.unknown":
          void hideScreenOverlay();
          setAssistantUiState("speaking");
          break;

        case "app.launcher.not_found": {
          const query =
            typeof event.payload.query === "string"
              ? event.payload.query
              : "";

          setSettingsInitialSection("apps");
          setSettingsInitialAppAlias(query);
          setSettingsInitialAppRequestId((current) => current + 1);
          setIsSettingsOpen(true);
          addGuiLog("[APP LAUNCHER] Add missing app alias");
          break;
        }

        case "drawing.generation.started": {
          const title =
            typeof event.payload.title === "string"
              ? event.payload.title
              : "Новый набросок";
          setDrawingNotice({
            status: "working",
            title,
            message: "Мелисса рисует. Можно продолжать разговор — Холст работает в фоне.",
          });
          addGuiLog("[DRAWING] Started: " + title);
          break;
        }

        case "drawing.created": {
          const drawingId =
            typeof event.payload.id === "string"
              ? event.payload.id
              : "";
          const title =
            typeof event.payload.title === "string"
              ? event.payload.title
              : "Новый набросок";
          const completionLine =
            typeof event.payload.completion_line === "string"
              ? event.payload.completion_line
              : "";
          setDrawingNotice({
            status: "ready",
            drawingId,
            title,
            message:
              completionLine
              || "Мелисса нарисовала кое-что. Открой Холст и посмотри.",
          });
          setUnreadDrawingCount((current) => current + 1);
          addGuiLog("[DRAWING] Saved locally: " + title);
          break;
        }

        case "drawing.generation.failed": {
          const title =
            typeof event.payload.title === "string"
              ? event.payload.title
              : "Набросок";
          setDrawingNotice({
            status: "error",
            title,
            message: "Рисунок не завершён. Проверь подключение и попробуй попросить ещё раз.",
          });
          addGuiLog("[DRAWING] Failed: " + title);
          break;
        }
      }
    }

    async function loadAssistantEvents() {
      try {
        const events =
          await fetchAssistantEvents();

        if (!mounted) return;

        const processedIds =
          processedEventIdsRef.current;

        for (const event of events) {
          if (processedIds.has(event.id)) {
            continue;
          }

          processedIds.add(event.id);
          applyAssistantEvent(event);
        }

        if (processedIds.size > 500) {
          processedEventIdsRef.current = new Set(
            events.slice(-300).map((event) => event.id)
          );
        }
      } catch (error) {
        console.error(error);
      }
    }

    loadAssistantEvents();

    const intervalId =
      window.setInterval(
        loadAssistantEvents,
        800
      );

    return () => {
      mounted = false;
      if (overlayHideTimeoutRef.current !== null) {
        window.clearTimeout(overlayHideTimeoutRef.current);
      }
      void hideScreenOverlay();
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const unlisten = listen<ScreenGuidanceAction>(
      "screen-guidance-action",
      async (event) => {
        if (!mounted) return;

        const { analysisId, action } = event.payload;
        if (!analysisId) return;

        try {
          if (action === "canvas") {
            await saveScreenToCanvas(analysisId);
            await hideScreenOverlay();
            return;
          }

          await dismissScreenGuidance(analysisId);
          await hideScreenOverlay();
        } catch (error) {
          console.error("Screen guidance action failed:", error);
          await hideScreenOverlay();
          setScreenNotice({
            status: "error",
            title: "Действие не выполнено",
            message:
              error instanceof Error
                ? error.message
                : "Предложение устарело. Сделай новый снимок экрана.",
          });
        }
      },
    );

    return () => {
      mounted = false;
      void unlisten.then((dispose) => dispose());
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadAssistantLogs() {
      try {
        const response = await fetchAssistantApi("/logs");

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        const data = await response.json();

        const apiLogs: AssistantApiLog[] =
          data.logs ?? [];

        if (mounted) {
          setAssistantLogs(
            apiLogs
              .slice(-120)
              .map(formatApiLog)
          );
        }
      } catch (error) {
        if (mounted) {
          const time =
            new Date().toLocaleTimeString();

          setAssistantLogs([
            `[${time}] [ERROR] Assistant logs API not reachable`,
          ]);
        }

        console.error(error);
      }
    }

    loadAssistantLogs();

    const intervalId =
      window.setInterval(
        loadAssistantLogs,
        1500
      );

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  function handleSettingsClick() {
    addGuiLog(
      "[SETTINGS] Settings opened"
    );
    setSettingsInitialSection("triggers");
    setSettingsInitialAppAlias("");
    setSettingsInitialAppRequestId((current) => current + 1);
    setIsSettingsOpen(true);
  }

  function handleProfileClick() {
    addGuiLog("[PROFILE] Profile opened");
    setIsProfileOpen(true);
  }

  function handleStoryClick() {
    addGuiLog("[STORY] Chronicle opened");
    setIsStoryOpen(true);
  }

  function openDrawingLibrary(drawingId = "") {
    addGuiLog("[DRAWING] Canvas opened");
    setDrawingInitialId(drawingId);
    setUnreadDrawingCount(0);
    setDrawingNotice(null);
    setIsDrawingOpen(true);
  }

  async function handleListeningToggle() {
    if (isLoading) return;

    try {
      setIsLoading(true);

      addGuiLog(
        "[VOICE] Switching listening mode..."
      );

      const status =
        await toggleAssistantListening();

      setIsListening(status.listening);

      if (status.listening) {
        addGuiLog(
          "[VOICE] Listening enabled"
        );
      } else {
        addGuiLog(
          "[VOICE] Listening disabled"
        );
      }
    } catch (error) {
      addGuiLog(
        "[ERROR] Failed to toggle listening"
      );

      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className={
        [
          "screen",
          "main-screen",
          isListening
            ? "listening-on"
            : "listening-off",
          `state-${assistantUiState}`,
        ].join(" ")
      }
    >
      <CyberPsychoBackground
        isListening={isListening}
      />

      <div className="top-left">
        <SettingsButton
          onClick={handleSettingsClick}
        />
        <button
          className="story-button"
          type="button"
          title="Хроника связи"
          onClick={handleStoryClick}
        >
          <span>⌁</span>
          Хроника
        </button>
        <button
          className="drawing-button"
          type="button"
          title="Холст Мелиссы"
          onClick={() => openDrawingLibrary()}
        >
          <span>✎</span>
          Холст
          {unreadDrawingCount > 0 && (
            <b>{Math.min(unreadDrawingCount, 9)}</b>
          )}
        </button>
      </div>

      <button
        className="profile-button"
        onClick={handleProfileClick}
      >
        {username}
      </button>

      <main className="assistant-center">
        <div className="logo-shell">
          <LogoOrb large />
        </div>

        <ListeningToggle
          isListening={isListening}
          onToggle={
            handleListeningToggle
          }
        />
      </main>

      <LogTerminal logs={logs} />

      {drawingNotice && (
        <div
          className={[
            "drawing-notice",
            "is-" + drawingNotice.status,
          ].join(" ")}
          role="status"
        >
          <button
            className="drawing-notice__body"
            type="button"
            disabled={!drawingNotice.drawingId}
            onClick={() =>
              openDrawingLibrary(drawingNotice.drawingId ?? "")
            }
          >
            <span>
              {drawingNotice.status === "working"
                ? "РИСУНОК В РАБОТЕ"
                : drawingNotice.status === "ready"
                ? "МЕЛИССА НАРИСОВАЛА КОЕ-ЧТО"
                : "РИСУНОК НЕ ЗАВЕРШЁН"}
            </span>
            <strong>{drawingNotice.title}</strong>
            <small>{drawingNotice.message}</small>
          </button>
          <button
            className="drawing-notice__close"
            type="button"
            aria-label="Закрыть уведомление"
            onClick={() => setDrawingNotice(null)}
          >
            ×
          </button>
        </div>
      )}

      {screenNotice && (
        <div
          className={`screen-notice is-${screenNotice.status}`}
          role="status"
        >
          <div>
            <span>SCREEN COPILOT</span>
            <strong>{screenNotice.title}</strong>
            <small>{screenNotice.message}</small>
          </div>
          <button
            type="button"
            aria-label="Закрыть уведомление"
            onClick={() => setScreenNotice(null)}
          >
            ×
          </button>
        </div>
      )}

      {isProfileOpen && (
        <ProfileModal
          onClose={() => setIsProfileOpen(false)}
          onLogout={onLogout}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          initialSection={settingsInitialSection}
          initialAppAlias={settingsInitialAppAlias}
          initialAppRequestId={settingsInitialAppRequestId}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {isStoryOpen && (
        <StoryModal
          onClose={() => setIsStoryOpen(false)}
        />
      )}

      {isDrawingOpen && (
        <DrawingModal
          initialDrawingId={drawingInitialId}
          onClose={() => {
            setIsDrawingOpen(false);
            setDrawingInitialId("");
          }}
        />
      )}
    </div>
  );
}
