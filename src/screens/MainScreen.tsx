import { useEffect, useState } from "react";
import LogoOrb from "../components/LogoOrb";
import LogTerminal from "../components/LogTerminal";
import SettingsButton from "../components/SettingsButton";
import { startCoreMock } from "../services/assistantCore";
import { clearSession } from "../services/session";

type Props = {
  onLogout: () => void;
};

export default function MainScreen({ onLogout }: Props) {
  const [logs, setLogs] = useState<string[]>([]);

  function addLog(log: string) {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-150), `[${time}] ${log}`]);
  }

  useEffect(() => {
    addLog("[GUI] Main screen opened");

    const stopCore = startCoreMock(addLog);

    return () => {
      stopCore();
    };
  }, []);

  function handleSettingsClick() {
    addLog("[SETTINGS] Settings clicked");
  }

  function handleLogout() {
    clearSession();
    onLogout();
  }

  return (
    <div className="screen main-screen">
      <div className="top-left">
        <SettingsButton onClick={handleSettingsClick} />
      </div>

      <button className="profile-button" onClick={() => addLog("[PROFILE] Profile clicked")}>
        Kak_taK_?
      </button>

      <main className="assistant-center">
        <LogoOrb large />
      </main>

      <LogTerminal logs={logs} />
    </div>
  );
}