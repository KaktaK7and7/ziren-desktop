import { useState } from "react";

import "./CoreErrorScreen.css";


type Props = {
  error: string;
  onRetry: () => Promise<void>;
  onLogout: () => void;
};


export default function CoreErrorScreen({ error, onRetry, onLogout }: Props) {
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");

  async function retry() {
    if (retrying) return;
    setRetrying(true);
    setRetryError("");
    try {
      await onRetry();
    } catch (reason) {
      setRetryError(
        reason instanceof Error ? reason.message : "Core снова не запустился.",
      );
    } finally {
      setRetrying(false);
    }
  }

  return (
    <main className="core-error-screen">
      <section className="core-error-card" role="alert">
        <span className="core-error-kicker">ZIREN / LOCAL CORE</span>
        <h1>Локальное ядро не запустилось</h1>
        <p>
          Аккаунт сохранён. Проблема возникла именно при запуске локального Core,
          поэтому повторный вход обычно не нужен.
        </p>

        <div className="core-error-detail">
          <strong>Диагностика</strong>
          <code>{retryError || error || "Неизвестная ошибка запуска Core"}</code>
        </div>

        <ul>
          <li>Проверь, что установка Ziren завершилась полностью.</li>
          <li>Если антивирус поместил Core в карантин — восстанови файл и повтори запуск.</li>
          <li>При повторяющейся ошибке сохрани этот текст для баг-репорта.</li>
        </ul>

        <div className="core-error-actions">
          <button type="button" className="is-primary" disabled={retrying} onClick={() => void retry()}>
            {retrying ? "Запускаю…" : "Повторить запуск Core"}
          </button>
          <button type="button" onClick={onLogout}>Выйти из аккаунта</button>
        </div>
      </section>
    </main>
  );
}
