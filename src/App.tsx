import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

import LoadingScreen from "./screens/LoadingScreen";
import LoginScreen from "./screens/LoginScreen";
import MainScreen from "./screens/MainScreen";
import TrayMenu from "./screens/TrayMenu";
import { hasSavedSession } from "./services/session";

type Screen = "loading" | "login" | "main";

export default function App() {
  const currentWindow = getCurrentWindow();

  if (currentWindow.label === "tray-menu") {
    return <TrayMenu />;
  }

  const [screen, setScreen] = useState<Screen>("loading");
  const [guiActive, setGuiActive] = useState(true);

  useEffect(() => {
    let unlistenPause: (() => void) | undefined;
    let unlistenResume: (() => void) | undefined;

    async function initTrayEvents() {
      unlistenPause = await listen("pause-ui", () => {
        setGuiActive(false);
      });

      unlistenResume = await listen("resume-ui", () => {
        setGuiActive(true);
      });
    }

    initTrayEvents();

    return () => {
      unlistenPause?.();
      unlistenResume?.();
    };
  }, []);

  useEffect(() => {
    if (!guiActive) return;

    const timer = window.setTimeout(() => {
      if (hasSavedSession()) {
        setScreen("main");
      } else {
        setScreen("login");
      }
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [guiActive]);

  if (!guiActive) {
    return null;
  }

  if (screen === "loading") {
    return <LoadingScreen />;
  }

  if (screen === "login") {
    return <LoginScreen onLoginSuccess={() => setScreen("main")} />;
  }

  return <MainScreen onLogout={() => setScreen("login")} />;
}