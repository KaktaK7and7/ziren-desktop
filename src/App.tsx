import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

import LoadingScreen from "./screens/LoadingScreen";
import LoginScreen from "./screens/LoginScreen";
import MainScreen from "./screens/MainScreen";
import ScreenOverlay from "./screens/ScreenOverlay";
import TrayMenu from "./screens/TrayMenu";
import CoreErrorScreen from "./screens/CoreErrorScreen";
import NetworkHost from "./components/NetworkHost";
import OnboardingHost from "./components/OnboardingHost";

import {
  getAuthSiteOrigin,
  validateSavedSession,
} from "./services/auth";
import {
  ensureLocalApiToken,
  waitForAssistantApi,
} from "./services/localApi";
import {
  clearSession,
  getCurrentUser,
  getSessionToken,
} from "./services/session";

type Screen = "loading" | "login" | "main" | "core-error";

function readableCoreError(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason || "");
  return message.trim().slice(0, 1200) || "Не удалось запустить локальный Core.";
}

export default function App() {
  const currentWindow = getCurrentWindow();
  const isTrayMenu = currentWindow.label === "tray-menu";
  const isScreenOverlay = currentWindow.label === "screen-overlay";

  const [screen, setScreen] = useState<Screen>("loading");
  const [coreError, setCoreError] = useState("");

  async function startAssistantAndOpenMain() {
    const desktopToken = getSessionToken();

    if (!desktopToken) {
      setScreen("login");
      throw new Error("Нет токена авторизации для запуска ассистента");
    }

    const localApiToken = ensureLocalApiToken();

    try {
      await invoke("start_assistant_core", {
        desktopToken,
        localApiToken,
        authSiteUrl: getAuthSiteOrigin(),
      });
      await waitForAssistantApi();
      setCoreError("");
      setScreen("main");
    } catch (reason) {
      const message = readableCoreError(reason);
      console.error("Failed to start assistant core:", reason);
      setCoreError(message);
      setScreen("core-error");
      throw reason;
    }
  }

  function logoutFromCoreError() {
    clearSession();
    setCoreError("");
    setScreen("login");
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
        } catch {
          // startAssistantAndOpenMain already moved the UI to a recoverable
          // Core error state. Do not misreport a local startup failure as auth.
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

  if (screen === "core-error") {
    return (
      <CoreErrorScreen
        error={coreError}
        onRetry={startAssistantAndOpenMain}
        onLogout={logoutFromCoreError}
      />
    );
  }

  return (
    <>
      <MainScreen onLogout={() => setScreen("login")} />
      <NetworkHost />
      <OnboardingHost />
    </>
  );
}
