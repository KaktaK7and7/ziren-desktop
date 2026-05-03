import { useEffect, useState } from "react";
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

  return <MainApp />;
}

function MainApp() {
  const [screen, setScreen] = useState<Screen>("loading");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (hasSavedSession()) {
        setScreen("main");
      } else {
        setScreen("login");
      }
    }, 1000);

    return () => window.clearTimeout(timer);
  }, []);

  if (screen === "loading") {
    return <LoadingScreen />;
  }

  if (screen === "login") {
    return <LoginScreen onLoginSuccess={() => setScreen("main")} />;
  }

  return <MainScreen onLogout={() => setScreen("login")} />;
}