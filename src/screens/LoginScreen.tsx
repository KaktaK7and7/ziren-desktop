import { FormEvent, useState } from "react";
import LogoOrb from "../components/LogoOrb";
import { loginUser } from "../services/auth";


type Props = {
  onLoginSuccess: () => Promise<void>;
};

export default function LoginScreen({ onLoginSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (isLoading) return;

    setError("");
    setIsLoading(true);

    try {
      await loginUser({
        email: email.trim(),
        password,
        remember,
      });


      await onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="screen login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <LogoOrb />

        <div className="login-header">
          <h1>Вход в Ziren Assistant</h1>
          <p>Авторизуйся, чтобы запустить ассистента</p>
        </div>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            autoComplete="email"
            disabled={isLoading}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Пароль</span>
          <input
            type="password"
            placeholder="Введите пароль"
            value={password}
            autoComplete="current-password"
            disabled={isLoading}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <label className="remember-row">
          <input
            type="checkbox"
            checked={remember}
            disabled={isLoading}
            onChange={(event) => setRemember(event.target.checked)}
          />
          <span>Запомнить меня</span>
        </label>

        {error && <div className="error-box">{error}</div>}

        <button className="primary-button" disabled={isLoading}>
          {isLoading ? "Входим..." : "Войти"}
        </button>
      </form>
    </div>
  );
}
