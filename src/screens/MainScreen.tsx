import { useEffect, useState } from "react";
import LogoOrb from "../components/LogoOrb";
import LogTerminal from "../components/LogTerminal";
import SettingsButton from "../components/SettingsButton";
import ListeningToggle from "../components/ListeningToggle";
import CyberPsychoBackground from "../components/CyberPsychoBackground";
import { startCoreMock } from "../services/assistantCore";

type Props = {
  onLogout: () => void;
};

export default function MainScreen({ onLogout }: Props) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(true);

  function addLog(log: string) {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-150), `[${time}] ${log}`]);
  }

  useEffect(() => {
    addLog("[GUI] Cyberpsychosis interface initialized");
    addLog("[VOICE] Listening enabled");
    addLog("[SYSTEM] Neural circuit skull online");

    const stopCore = startCoreMock(addLog);

    return () => {
      stopCore();
    };
  }, []);

  function handleSettingsClick() {
    addLog("[SETTINGS] Settings clicked");
  }

  function handleProfileClick() {
    addLog("[PROFILE] Profile clicked");
  }

  function handleListeningToggle() {
    setIsListening((prev) => {
      const next = !prev;

      if (next) {
        addLog("[VOICE] Listening enabled");
      } else {
        addLog("[VOICE] Listening disabled");
      }

      return next;
    });
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