import { useEffect, useState } from "react";

import LogoOrb from "../components/LogoOrb";
import LogTerminal from "../components/LogTerminal";
import SettingsButton from "../components/SettingsButton";
import ListeningToggle from "../components/ListeningToggle";
import CyberPsychoBackground from "../components/CyberPsychoBackground";
import ProfileModal from "../components/ProfileModal";

import {
  getAssistantStatus,
  toggleAssistantListening,
} from "../services/assistantApi";

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
        setIsListening(false);

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
      "[SETTINGS] Settings clicked"
    );
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
        isListening
          ? "screen main-screen listening-on"
          : "screen main-screen listening-off"
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
    </div>
  );
}