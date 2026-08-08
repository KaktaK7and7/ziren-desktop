import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

import LoadingScreen from "./screens/LoadingScreen";
import LoginScreen from "./screens/LoginScreen";
import MainScreen from "./screens/MainScreen";
import ScreenOverlay from "./screens/ScreenOverlay";
import TrayMenu from "./screens/TrayMenu";
import NetworkHost from "./components/NetworkHost";

import {
  getAuthSiteOrigin,
  validateSavedSession,
} from "./services/auth";
import {
  ensureLocalApiToken,
  waitForAssistantApi,
} from "./services/localApi";
import { getCurrentUser, getSessionToken } from "./services/session";

type Screen = "loading" | "login" | "main";

export default function App() {
  const currentWindow = getCurrentWindow();
  const isTrayMenu = currentWindow.label === "tray-menu";
  const isScreenOverlay = currentWindow.label === "screen-overlay";

  const [screen, setScreen] = useState<Screen>("loading");

  async function startAssistantAndOpenMain() {
    const desktopToken = getSessionToken();

    if (!desktopToken) {
      setScreen("login");
      throw new Error("Нет токена авторизации для запуска ассистента");
    }

    const localApiToken = ensureLocalApiToken();

    await invoke("start_assistant_core", {
      desktopToken,
      localApiToken,
      authSiteUrl: getAuthSiteOrigin(),
    });
    await waitForAssistantApi();
    setScreen("main");
  }

  useEffect(() => {
    if (isTrayMenu || isScreenOverlay) return;

    async function bootstrap() {
      const localUser = getCurrentUser();

      if (!localUser) {
        setScreen("login");
        return;
      }

      const validUser = await validateSavedSession();

      if (validUser) {
        try {
          await startAssistantAndOpenMain();
        } catch (error) {
          console.error("Failed to start assistant core:", error);
          setScreen("login");
        }
      } else {
        setScreen("login");
      }
    }

    bootstrap();
  }, [isTrayMenu, isScreenOverlay]);

  if (isScreenOverlay) {
    return <ScreenOverlay />;
  }

  if (isTrayMenu) {
    return <TrayMenu />;
  }

  if (screen === "loading") {
    return <LoadingScreen />;
  }

  if (screen === "login") {
    return <LoginScreen onLoginSuccess={startAssistantAndOpenMain} />;
  }

  return (
    <>
      <MainScreen onLogout={() => setScreen("login")} />
      <NetworkHost />
    </>
  );
}
