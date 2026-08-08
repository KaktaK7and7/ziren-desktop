import { useEffect, useMemo, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";

import NetworkModal, { type NetworkTab } from "./NetworkModal";
import {
  fetchFriendCode,
  fetchFriends,
  fetchGroups,
  searchUsers,
  socialProfileUrl,
} from "../services/social";
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
  const peopleRef = useRef<Map<string, number>>(new Map());
  const lastSearchRef = useRef("");

  function rememberPerson(id: number, username: string) {
    if (!id || !username) return;
    peopleRef.current.set(username.trim().toLocaleLowerCase("ru-RU"), Number(id));
  }

  async function refreshCounters() {
    try {
      const [friendsData, groups, code] = await Promise.all([
        fetchFriends(),
        fetchGroups(),
        fetchFriendCode(),
      ]);
      for (const friend of friendsData.friends) {
        rememberPerson(friend.id, friend.username);
      }
      for (const request of friendsData.requests) {
        rememberPerson(request.user.id, request.user.username);
      }
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

  async function openNetworkProfile(userId: number) {
    const url = socialProfileUrl(`/network-profile.html?id=${Number(userId)}`);
    if (!url) return;
    try {
      await openUrl(url);
    } catch {
      // Ошибка открытия профиля не должна ломать Network workspace.
    }
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

  useEffect(() => {
    if (openTab !== "friends") return;
    let disposed = false;
    let searchTimer: number | null = null;

    function wireProfileTarget(element: HTMLElement | null, userId: number, username: string) {
      if (!element || element.dataset.networkProfileWired === "true") return;
      element.dataset.networkProfileWired = "true";
      element.style.cursor = "pointer";
      element.title = `Открыть профиль ${username}`;
      element.addEventListener("click", () => void openNetworkProfile(userId));
    }

    function enhanceRows() {
      const input = document.querySelector<HTMLInputElement>(
        ".network-search-row .network-input",
      );
      if (input) {
        input.placeholder = "Ник или код ZR-XXXXXX";
        input.title = "Можно искать по нику или постоянному коду пользователя Ziren";

        const query = input.value.trim();
        if (
          query.length >= 2
          && query !== lastSearchRef.current
          && searchTimer === null
        ) {
          searchTimer = window.setTimeout(() => {
            searchTimer = null;
            if (disposed) return;
            lastSearchRef.current = query;
            void searchUsers(query)
              .then((people) => {
                for (const person of people) rememberPerson(person.id, person.username);
                enhanceRows();
              })
              .catch(() => undefined);
          }, 180);
        }
      }

      document.querySelectorAll<HTMLElement>(".network-person-row").forEach((row) => {
        const nameElement = row.querySelector<HTMLElement>(".network-person-copy strong");
        const username = nameElement?.textContent?.trim() || "";
        const userId = peopleRef.current.get(username.toLocaleLowerCase("ru-RU"));
        if (!userId) return;

        wireProfileTarget(row.querySelector<HTMLElement>("img"), userId, username);
        wireProfileTarget(nameElement, userId, username);

        const actions = row.querySelector<HTMLElement>(".network-actions");
        if (actions && !actions.querySelector("[data-network-profile-button]")) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "network-btn is-ghost";
          button.dataset.networkProfileButton = "true";
          button.textContent = "Профиль";
          button.addEventListener("click", () => void openNetworkProfile(userId));
          actions.prepend(button);
        }
      });
    }

    const timeoutId = window.setTimeout(enhanceRows, 0);
    const observer = new MutationObserver(enhanceRows);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      disposed = true;
      window.clearTimeout(timeoutId);
      if (searchTimer !== null) window.clearTimeout(searchTimer);
      observer.disconnect();
      lastSearchRef.current = "";
    };
  }, [openTab]);

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
