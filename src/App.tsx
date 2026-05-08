import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import LoadingScreen from "./screens/LoadingScreen";
import LoginScreen from "./screens/LoginScreen";
import MainScreen from "./screens/MainScreen";

import { validateSavedSession } from "./services/auth";
import { getCurrentUser } from "./services/session";

type Screen = "loading" | "login" | "main";

export default function App() {
  const [screen, setScreen] = useState<Screen>("loading");

  async function startAssistantAndOpenMain() {
    try {
      await invoke("start_assistant_core");
    } catch (error) {
      console.error("Failed to start assistant core:", error);
    }

    setScreen("main");
  }

  useEffect(() => {
    async function bootstrap() {
      const localUser = getCurrentUser();

      if (!localUser) {
        setScreen("login");
        return;
      }

      const validUser = await validateSavedSession();

      if (validUser) {
        await startAssistantAndOpenMain();
      } else {
        setScreen("login");
      }
    }

    bootstrap();
  }, []);

  if (screen === "loading") {
    return <LoadingScreen />;
  }

  if (screen === "login") {
    return (
      <LoginScreen
        onLoginSuccess={startAssistantAndOpenMain}
      />
    );
  }

  return (
    <MainScreen
      onLogout={() => setScreen("login")}
    />
  );
}