import { useEffect, useMemo, useState } from "react";

import NetworkModal, { type NetworkTab } from "./NetworkModal";
import { fetchFriendCode, fetchFriends, fetchGroups } from "../services/social";
import { getCurrentUser } from "../services/session";
import "./NetworkCompact.css";
import "./NetworkHost.css";

type NetworkOpenEvent = CustomEvent<{ tab?: NetworkTab }>;

export default function NetworkHost() {
  const user = getCurrentUser();
  const [openTab, setOpenTab] = useState<NetworkTab | null>(null);
  const [friendCount, setFriendCount] = useState(0);
  const [incomingCount, setIncomingCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [friendCode, setFriendCode] = useState("");
  const [copied, setCopied] = useState(false);

  async function refreshCounters() {
    try {
      const [friendsData, groups, code] = await Promise.all([
        fetchFriends(),
        fetchGroups(),
        fetchFriendCode(),
      ]);
      setFriendCount(friendsData.friends.length);
      setIncomingCount(
        friendsData.requests.filter((request) => request.direction === "incoming").length,
      );
      setFriendCode(code);
      setUnreadCount(
        friendsData.friends.reduce(
          (sum, friend) => sum + Number(friend.unread_count || 0),
          0,
        )
          + groups.reduce(
            (sum, group) => sum + Number(group.unread_count || 0),
            0,
          ),
      );
    } catch {
      // Основной интерфейс ассистента не должен зависеть от social API.
    }
  }

  function openProfile() {
    const profileButton = document.querySelector<HTMLButtonElement>(".profile-button");
    profileButton?.click();
  }

  async function copyFriendCode() {
    if (!friendCode) return;
    try {
      await navigator.clipboard.writeText(friendCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  useEffect(() => {
    void refreshCounters();
    const id = window.setInterval(() => void refreshCounters(), 7000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function handleOpen(event: Event) {
      const detail = (event as NetworkOpenEvent).detail;
      setOpenTab(detail?.tab === "messages" ? "messages" : "friends");
    }

    window.addEventListener("ziren-network-open", handleOpen);
    return () => window.removeEventListener("ziren-network-open", handleOpen);
  }, []);

  const unreadLabel = useMemo(
    () => (unreadCount > 99 ? "99+" : String(unreadCount)),
    [unreadCount],
  );

  return (
    <>
      <div className="network-account-menu-host" aria-label="Меню аккаунта Ziren">
        <div className="network-account-menu">
          <div className="network-account-menu__head">
            <span>ZIREN NETWORK</span>
            <strong>{user?.username || "Пользователь"}</strong>
          </div>

          <button
            className="network-account-menu__item"
            type="button"
            onClick={openProfile}
          >
            <span>Профиль</span>
            <small>Аккаунт и настройки</small>
          </button>

          <button
            className="network-account-menu__item"
            type="button"
            onClick={() => setOpenTab("friends")}
          >
            <span>
              Друзья
              {incomingCount > 0 && <b>{incomingCount > 99 ? "99+" : incomingCount}</b>}
            </span>
            <small>{friendCount} в списке</small>
          </button>

          <button
            className="network-account-menu__item"
            type="button"
            onClick={() => setOpenTab("messages")}
          >
            <span>
              Сообщения
              {unreadCount > 0 && <b>{unreadLabel}</b>}
            </span>
            <small>{unreadCount > 0 ? "Есть непрочитанные" : "Личные чаты и группы"}</small>
          </button>

          <div className="network-account-menu__code">
            <div>
              <small>КОД ДЛЯ ДОБАВЛЕНИЯ</small>
              <strong>{friendCode || "…"}</strong>
            </div>
            <button type="button" disabled={!friendCode} onClick={() => void copyFriendCode()}>
              {copied ? "✓" : "Копировать"}
            </button>
          </div>
        </div>
      </div>

      {openTab && (
        <NetworkModal
          initialTab={openTab}
          onClose={() => {
            setOpenTab(null);
            void refreshCounters();
          }}
        />
      )}
    </>
  );
}
