import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import LogoOrb from "../components/LogoOrb";
import LogTerminal from "../components/LogTerminal";
import SettingsButton from "../components/SettingsButton";
import SettingsModal from "../components/SettingsModal";
import ListeningToggle from "../components/ListeningToggle";
import CyberPsychoBackground from "../components/CyberPsychoBackground";
import ProfileModal from "../components/ProfileModal";

import {
  getAssistantStatus,
  toggleAssistantListening,
} from "../services/assistantApi";

import {
  fetchAssistantEvents,
  type AssistantEvent,
} from "../services/assistantEvents";

import { getCurrentUser } from "../services/session";

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

  const [assistantUiState, setAssistantUiState] =
    useState<AssistantUiState>("idle");

  const [, setIsListeningOverlayActive] =
    useState(false);

  const processedEventIdsRef =
    useRef<Set<string>>(new Set());
  const overlayHideTimeoutRef =
    useRef<number | null>(null);

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

  async function showScreenOverlay() {
    if (overlayHideTimeoutRef.current !== null) {
      window.clearTimeout(overlayHideTimeoutRef.current);
      overlayHideTimeoutRef.current = null;
    }

    setIsListeningOverlayActive(true);

    try {
      await invoke("show_listening_overlay");
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
      await invoke("hide_listening_overlay");
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

    async function loadAssistantLogs() {
      try {
        const response = await fetch(
          "http://127.0.0.1:8787/logs"
        );

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
    setIsSettingsOpen(true);
  }

  function handleProfileClick() {
    addGuiLog("[PROFILE] Profile opened");
    setIsProfileOpen(true);
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

      {isProfileOpen && (
        <ProfileModal
          onClose={() => setIsProfileOpen(false)}
          onLogout={onLogout}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
}
