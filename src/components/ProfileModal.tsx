import { useEffect, useMemo, useState } from "react";
import {
  getCurrentUser,
  clearSession,
  type UserData,
} from "../services/session";
import {
  fetchDesktopProfile,
  getProfileUrl,
  resolveAuthAssetUrl,
} from "../services/auth";
import "./ProfileModal.css";

type Props = {
  onClose: () => void;
  onLogout: () => void;
};

function formatDate(value?: string) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString("ru-RU");
  } catch {
    return "—";
  }
}

export default function ProfileModal({ onClose, onLogout }: Props) {
  const [user, setUser] = useState<UserData | null>(getCurrentUser());
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState("");

  const avatarUrl = useMemo(() => {
    return resolveAuthAssetUrl(user?.avatar_url);
  }, [user?.avatar_url]);

  const initial = (user?.username ?? "Z").slice(0, 1).toUpperCase();

  async function syncProfile() {
    try {
      setError("");
      setIsSyncing(true);

      const freshUser = await fetchDesktopProfile();
      setUser(freshUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка синхронизации");
    } finally {
      setIsSyncing(false);
    }
  }

  function handleLogout() {
    clearSession();
    onLogout();
  }

  function handleOpenSiteProfile() {
    window.open(getProfileUrl(), "_blank");
  }

  useEffect(() => {
    syncProfile();
  }, []);

  return (
    <div className="profile-page-overlay">
      <div className="profile-page-bg" />

      <div className="profile-page">
        <header className="profile-topbar">
          <div>
            <span className="profile-kicker">ZIREN NETWORK</span>
            <h1>Профиль пользователя</h1>
          </div>

          <div className="profile-topbar-actions">
            <button onClick={syncProfile} disabled={isSyncing}>
              {isSyncing ? "Синхронизация..." : "Синхронизировать"}
            </button>

            <button onClick={onClose}>Назад</button>
          </div>
        </header>

        {error && <div className="profile-error">{error}</div>}

        <section className="profile-hero-card">
          <div className="profile-cover">
            <div className="profile-cover-grid" />
            <div className="profile-cover-glow" />
          </div>

          <div className="profile-hero-content">
            <div className="profile-avatar-wrap">
              {avatarUrl ? (
                <img className="profile-avatar-img" src={avatarUrl} alt="avatar" />
              ) : (
                <div className="profile-avatar-fallback">{initial}</div>
              )}
            </div>

            <div className="profile-main-info">
              <div className="profile-name-row">
                <h2>{user?.username ?? "Unknown"}</h2>
                <span className="profile-online-badge">ONLINE</span>
              </div>

              <p>{user?.email ?? "—"}</p>

              <div className="profile-tags">
                <span>Desktop User</span>
                <span>AI Connected</span>
                <span>Public Profile</span>
              </div>
            </div>

            <div className="profile-level-card">
              <span>LEVEL</span>
              <strong>01</strong>
            </div>
          </div>
        </section>

        <main className="profile-content-grid">
          <section className="profile-panel profile-about-panel">
            <div className="profile-panel-head">
              <span>OVERVIEW</span>
              <h3>Информация</h3>
            </div>

            <div className="profile-info-list">
              <div>
                <span>ID</span>
                <strong>{user?.id ?? "—"}</strong>
              </div>

              <div>
                <span>Регистрация</span>
                <strong>{formatDate(user?.created_at)}</strong>
              </div>

              <div>
                <span>Последний вход</span>
                <strong>{formatDate(user?.last_login_at)}</strong>
              </div>

              <div>
                <span>Статус</span>
                <strong>Authorized</strong>
              </div>
            </div>

            <div className="profile-actions">
              <button onClick={handleOpenSiteProfile}>Открыть профиль на сайте</button>
              <button className="danger" onClick={handleLogout}>
                Выйти из аккаунта
              </button>
            </div>
          </section>

          <section className="profile-panel profile-progress-panel">
            <div className="profile-panel-head">
              <span>PROGRESS</span>
              <h3>Прогресс</h3>
            </div>

            <div className="profile-progress-row">
              <div>
                <strong>0</strong>
                <span>Достижений</span>
              </div>

              <div>
                <strong>0</strong>
                <span>Команд</span>
              </div>

              <div>
                <strong>0</strong>
                <span>Диалогов</span>
              </div>
            </div>

            <div className="profile-progress-bar">
              <div style={{ width: "12%" }} />
            </div>

            <p className="profile-muted-text">
              Здесь позже будет прогресс пользователя, достижения, активность и игровые события.
            </p>
          </section>

          <section className="profile-panel profile-achievements-panel">
            <div className="profile-panel-head">
              <span>ACHIEVEMENTS</span>
              <h3>Достижения</h3>
            </div>

            <div className="profile-achievements">
              <div className="profile-achievement locked">?</div>
              <div className="profile-achievement locked">?</div>
              <div className="profile-achievement locked">?</div>
              <div className="profile-achievement locked">?</div>
              <div className="profile-achievement locked">?</div>
            </div>
          </section>

          <section className="profile-panel profile-social-panel">
            <div className="profile-panel-head">
              <span>SOCIAL</span>
              <h3>Социальные функции</h3>
            </div>

            <div className="profile-feature-list">
              <div>
                <strong>Сообщения</strong>
                <span>Скоро</span>
              </div>

              <div>
                <strong>Озвучивание переписок</strong>
                <span>Скоро</span>
              </div>

              <div>
                <strong>Видеозвонки</strong>
                <span>Скоро</span>
              </div>

              <div>
                <strong>Демонстрация экрана</strong>
                <span>Скоро</span>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}