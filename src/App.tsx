import { useEffect, useState } from "react";
import LoadingScreen from "./screens/LoadingScreen";
import LoginScreen from "./screens/LoginScreen";
import MainScreen from "./screens/MainScreen";
import { validateSavedSession } from "./services/auth";
import { getCurrentUser } from "./services/session";

type Screen = "loading" | "login" | "main";

export default function App() {
  const [screen, setScreen] = useState<Screen>("loading");

  useEffect(() => {
    async function bootstrap() {
      const localUser = getCurrentUser();

      if (!localUser) {
        setScreen("login");
        return;
      }

      const validUser = await validateSavedSession();

      if (validUser) {
        setScreen("main");
      } else {
        setScreen("login");
      }
    }

    const timer = window.setTimeout(() => {
      bootstrap();
    }, 800);

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