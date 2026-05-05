import { useEffect, useState } from "react";
import LogoOrb from "../components/LogoOrb";
import LogTerminal from "../components/LogTerminal";
import SettingsButton from "../components/SettingsButton";
import ListeningToggle from "../components/ListeningToggle";
import CyberPsychoBackground from "../components/CyberPsychoBackground";
import {
  getAssistantStatus,
  toggleAssistantListening,
} from "../services/assistantApi";

type Props = {
  onLogout: () => void;
};

export default function MainScreen({ onLogout }: Props) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  function addLog(log: string) {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-150), `[${time}] ${log}`]);
  }

  useEffect(() => {
    addLog("[GUI] Cyberpsychosis interface initialized");
    addLog("[SYSTEM] Connecting to assistant...");

    async function initAssistantStatus() {
      try {
        const status = await getAssistantStatus();

        setIsListening(status.listening);
        addLog("[SYSTEM] Assistant connected");

        if (status.listening) {
          addLog("[VOICE] Listening enabled");
        } else {
          addLog("[VOICE] Listening disabled");
        }
      } catch (error) {
        setIsListening(false);
        addLog("[ERROR] Assistant not reachable");
        console.error(error);
      }
    }

    initAssistantStatus();
  }, []);

  function handleSettingsClick() {
    addLog("[SETTINGS] Settings clicked");
  }

  function handleProfileClick() {
    addLog("[PROFILE] Profile clicked");
  }

  async function handleListeningToggle() {
    if (isLoading) return;

    try {
      setIsLoading(true);

      const status = await toggleAssistantListening();

      setIsListening(status.listening);

      if (status.listening) {
        addLog("[VOICE] Listening enabled");
      } else {
        addLog("[VOICE] Listening disabled");
      }
    } catch (error) {
      addLog("[ERROR] Failed to toggle listening");
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
      <CyberPsychoBackground isListening={isListening} />

      <div className="top-left">
        <SettingsButton onClick={handleSettingsClick} />
      </div>

      <button className="profile-button" onClick={handleProfileClick}>
        KaktaK7
      </button>

      <main className="assistant-center">
        <div className="logo-shell">
          <LogoOrb large />
        </div>

        <ListeningToggle
          isListening={isListening}
          onToggle={handleListeningToggle}
        />
      </main>

      <LogTerminal logs={logs} />
    </div>
  );
}