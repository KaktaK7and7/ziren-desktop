import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

import SocialPanel from "./SocialPanel";
import {
  getCurrentUser,
  type UserData,
} from "../services/session";

import {
  fetchDesktopProfile,
  getProfileUrl,
  logoutUser,
  resolveAuthAssetUrl,
  updateDesktopPreferences,
  uploadDesktopAvatar,
} from "../services/auth";
import { clearLocalApiToken } from "../services/localApi";

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
  const stats = user?.stats;
  const achievements = user?.achievements ?? [];
  const parsedUserId = Number.parseInt(user?.id ?? "", 10);
  const currentUserId = Number.isInteger(parsedUserId) && parsedUserId > 0
    ? parsedUserId
    : null;

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

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setError("");
      setIsSyncing(true);

      const updatedUser = await uploadDesktopAvatar(file);
      setUser(updatedUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки аватарки");
    } finally {
      setIsSyncing(false);
      event.target.value = "";
    }
  }

  async function handleLogout() {
    setError("");
    setIsSyncing(true);

    try {
      await logoutUser();
    } catch (err) {
      console.error("Failed to revoke desktop session:", err);
    } finally {
      try {
        await invoke("stop_assistant_core");
      } catch (err) {
        console.error("Failed to stop assistant core:", err);
      }

      clearLocalApiToken();
      setIsSyncing(false);
      onLogout();
    }
  }

  async function handleOpenSiteProfile() {
    try {
      await openUrl(getProfileUrl());
    } catch (err) {
      setError("Не удалось открыть профиль в браузере");
      console.error(err);
    }
  }

  async function handlePrivacyChange(
    activityTrackingEnabled: boolean,
    aiContextEnabled: boolean,
  ) {
    try {
      setError("");
      setIsSyncing(true);
      const updatedUser = await updateDesktopPreferences({
        activity_tracking_enabled: activityTrackingEnabled,
        ai_context_enabled:
          activityTrackingEnabled && aiContextEnabled,
      });
      setUser(updatedUser);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось сохранить настройки приватности",
      );
    } finally {
      setIsSyncing(false);
    }
  }

  useEffect(() => {
    syncProfile();

    const intervalId = window.setInterval(() => {
      syncProfile();
    }, 20000);

    return () => {
      window.clearInterval(intervalId);
    };
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
            {isSyncing && <span className="profile-sync-status">SYNC...</span>}

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

              <label className="profile-avatar-upload">
                {isSyncing ? "Загрузка..." : "Сменить"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarChange}
                  disabled={isSyncing}
                />
              </label>
            </div>

            <div className="profile-main-info">
              <div className="profile-name-row">
                <h2>{user?.username ?? "Unknown"}</h2>
                <span className="profile-online-badge">ONLINE</span>
              </div>

              <p>{user?.email ?? "—"}</p>
              {user?.status_text && (
                <p className="profile-status-text">{user.status_text}</p>
              )}

              <div className="profile-tags">
                <span>Desktop User</span>
                {user?.show_in_community && <span>Ziren Network</span>}
                {user?.public_profile_enabled && <span>Public Profile</span>}
                {user?.activity_tracking_enabled && <span>Activity Enabled</span>}
              </div>
            </div>

            <div className="profile-level-card">
              <span>LEVEL</span>
              <strong>{String(stats?.level ?? 1).padStart(2, "0")}</strong>
            </div>
          </div>
        </section>

        <main className="profile-content-grid">
          <section className="profile-panel">
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

              <div>
                <span>В Ziren</span>
                <strong>{stats ? `${stats.member_days} дн.` : "—"}</strong>
              </div>
            </div>

            {user?.bio && (
              <p className="profile-muted-text">{user.bio}</p>
            )}

            <div className="profile-actions">
              <button onClick={handleOpenSiteProfile}>
                Открыть профиль в браузере
              </button>

              <button className="danger" onClick={handleLogout}>
                Выйти из аккаунта
              </button>
            </div>
          </section>

          <section className="profile-panel">
            <div className="profile-panel-head">
              <span>PROGRESS</span>
              <h3>Прогресс</h3>
            </div>

            <div className="profile-progress-row">
              <div>
                <strong>{stats?.achievements_unlocked ?? 0}</strong>
                <span>Достижений</span>
              </div>

              <div>
                <strong>{stats?.total_commands ?? 0}</strong>
                <span>Команд</span>
              </div>

              <div>
                <strong>{stats?.distinct_commands ?? 0}</strong>
                <span>Функций</span>
              </div>
            </div>

            <div className="profile-progress-bar">
              <div style={{ width: `${stats?.level_progress_percent ?? 0}%` }} />
            </div>

            <p className="profile-muted-text">
              {user?.activity_tracking_enabled
                ? `До следующего уровня: ${stats?.commands_to_next_level ?? 25} команд.`
                : "Учёт функций выключен. Его можно включить ниже в настройках приватности."}
            </p>
          </section>

          <section className="profile-panel profile-privacy-panel">
            <div className="profile-panel-head">
              <span>PRIVACY & CONTEXT</span>
              <h3>Учёт функций</h3>
            </div>

            <div className="profile-consent-list">
              <label>
                <span>
                  <strong>Статистика команд</strong>
                  <small>
                    Считать использованные функции для прогресса и достижений.
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(user?.activity_tracking_enabled)}
                  disabled={isSyncing || !user}
                  onChange={(event) =>
                    void handlePrivacyChange(
                      event.target.checked,
                      event.target.checked
                        ? Boolean(user?.ai_context_enabled)
                        : false,
                    )
                  }
                />
              </label>

              <label>
                <span>
                  <strong>Контекст для Мелиссы</strong>
                  <small>
                    Разрешить учитывать сохранённые действия в естественных
                    репликах. Для команды сохраняется её короткая распознанная
                    формулировка; содержимое экрана и файлов не передаётся.
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(user?.ai_context_enabled)}
                  disabled={
                    isSyncing ||
                    !user?.activity_tracking_enabled
                  }
                  onChange={(event) =>
                    void handlePrivacyChange(
                      true,
                      event.target.checked,
                    )
                  }
                />
              </label>
            </div>

            <p className="profile-muted-text">
              Настройки синхронизируются с аккаунтом. Мелисса получает только
              события и формулировки команд, которые вы явно разрешили
              учитывать.
            </p>
          </section>

          <section className="profile-panel">
            <div className="profile-panel-head">
              <span>ACHIEVEMENTS</span>
              <h3>Достижения</h3>
            </div>

            <div className="profile-achievements">
              {achievements.length ? (
                achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className={`profile-achievement${
                      achievement.unlocked ? " unlocked" : ""
                    }`}
                  >
                    <div className="profile-achievement-icon" aria-hidden="true">
                      {achievement.unlocked ? achievement.icon : "?"}
                    </div>
                    <div className="profile-achievement-copy">
                      <strong>{achievement.title}</strong>
                      <span>{achievement.description}</span>
                    </div>
                    <small>
                      {achievement.unlocked ? "ПОЛУЧЕНО" : "НЕ ОТКРЫТО"}
                    </small>
                  </div>
                ))
              ) : (
                <p className="profile-muted-text">
                  Достижения появятся после синхронизации профиля.
                </p>
              )}
            </div>
          </section>

          <SocialPanel currentUserId={currentUserId} />
        </main>
      </div>
    </div>
  );
}